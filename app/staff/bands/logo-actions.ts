
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { UUID_PATTERN } from "@/lib/band-validation";

const BUCKET = "band-logos";
const MAX_SIZE = 2 * 1024 * 1024;

export type LogoActionState = {
  ok: boolean;
  message: string;
};

const INITIAL_ERROR = "Unable to complete the logo operation.";

function errorState(message: string): LogoActionState {
  return {
    ok: false,
    message,
  };
}

function successState(message: string): LogoActionState {
  return {
    ok: true,
    message,
  };
}

function getBandId(formData: FormData): string | null {
  const value = formData.get("band_id");

  if (
    typeof value !== "string" ||
    !UUID_PATTERN.test(value)
  ) {
    return null;
  }

  return value;
}

async function authorizedBand(bandId: string) {
  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !auth?.claims?.sub) {
    return null;
  }

  const { data: staff, error: staffError } =
    await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", auth.claims.sub)
      .maybeSingle();

  if (
    staffError ||
    staff?.status !== "active" ||
    !["owner", "admin", "editor"].includes(
      staff.role
    )
  ) {
    return null;
  }

  const { data: band, error: bandError } =
    await supabase
      .from("bands")
      .select("id, name, slug, logo_path, archived_at")
      .eq("id", bandId)
      .maybeSingle();

  if (bandError || !band) {
    return null;
  }

  if (band.archived_at) {
    return null;
  }

  return { supabase, band };
}

function imageExtension(
  bytes: Uint8Array,
  mimeType: string
): "png" | "jpg" | "webp" | null {
  if (
    mimeType === "image/png" &&
    bytes.length >= 8 &&
    bytes[0] === 137 &&
    bytes[1] === 80 &&
    bytes[2] === 78 &&
    bytes[3] === 71 &&
    bytes[4] === 13 &&
    bytes[5] === 10 &&
    bytes[6] === 26 &&
    bytes[7] === 10
  ) {
    return "png";
  }

  if (
    mimeType === "image/jpeg" &&
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  ) {
    return "jpg";
  }

  if (
    mimeType === "image/webp" &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) ===
      "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) ===
      "WEBP"
  ) {
    return "webp";
  }

  return null;
}

function getMimeType(extension: string): string {
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      throw new Error("Unsupported image format.");
  }
}

function refreshBand(
  bandId: string,
  slug: string | null
) {
  revalidatePath(`/staff/bands/${bandId}`);
  revalidatePath("/staff/bands");
  revalidatePath("/bands");

  if (slug) {
    revalidatePath(`/bands/${slug}`);
  }
}

export async function uploadBandLogo(
  _previousState: LogoActionState,
  formData: FormData
): Promise<LogoActionState> {
  const bandId = getBandId(formData);

  if (!bandId) {
    return errorState("Invalid band identifier.");
  }

  const context = await authorizedBand(bandId);

  if (!context) {
    return errorState(
      "You do not have permission to edit this band."
    );
  }

  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    return errorState("Select an image to upload.");
  }

  if (file.size > MAX_SIZE) {
    return errorState(
      "The image must be 2 MB or smaller."
    );
  }

  if (
    !["image/png", "image/jpeg", "image/webp"].includes(
      file.type
    )
  ) {
    return errorState(
      "Only PNG, JPEG, and WebP images are allowed."
    );
  }

  try {
    const buffer = Buffer.from(
      await file.arrayBuffer()
    );

    const extension = imageExtension(
      new Uint8Array(buffer.subarray(0, 16)),
      file.type
    );

    if (!extension) {
      return errorState(
        "The file does not appear to be a valid supported image."
      );
    }

    const objectPath =
      `bands/${bandId}/${randomUUID()}.${extension}`;

    const { supabase, band } = context;

    const { error: uploadError } =
      await supabase.storage
        .from(BUCKET)
        .upload(objectPath, buffer, {
          contentType: getMimeType(extension),
          cacheControl: "3600",
          upsert: false,
        });

    if (uploadError) {
      console.error(
        "Band logo upload:",
        uploadError.message
      );
      return errorState(
        "Image upload failed. Check the storage bucket and permissions."
      );
    }

    // Only replace the database reference if it
    // still points to the logo we originally loaded.
    // This prevents silently overwriting a concurrent edit.
    let update = supabase
      .from("bands")
      .update({ logo_path: objectPath })
      .eq("id", bandId);

    if (band.logo_path) {
      update = update.eq(
        "logo_path",
        band.logo_path
      );
    } else {
      update = update.is("logo_path", null);
    }

    const { data: changed, error: updateError } =
      await update
        .select("id")
        .maybeSingle();

    if (updateError || !changed) {
      await supabase.storage
        .from(BUCKET)
        .remove([objectPath]);

      return errorState(
        "The band record changed while uploading. Refresh and try again."
      );
    }

    // Remove the old image after the database is updated.
    if (
      band.logo_path &&
      band.logo_path.startsWith(`bands/${bandId}/`)
    ) {
      const { error: cleanupError } =
        await supabase.storage
          .from(BUCKET)
          .remove([band.logo_path]);

      if (cleanupError) {
        console.error(
          "Old logo cleanup:",
          cleanupError.message
        );
      }
    }

    refreshBand(bandId, band.slug);

    return successState(
      band.logo_path
        ? "Band logo replaced successfully."
        : "Band logo uploaded successfully."
    );
  } catch (error) {
    console.error("Band logo operation:", error);
    return errorState(INITIAL_ERROR);
  }
}

export async function removeBandLogo(
  _previousState: LogoActionState,
  formData: FormData
): Promise<LogoActionState> {
  const bandId = getBandId(formData);

  if (!bandId) {
    return errorState("Invalid band identifier.");
  }

  const context = await authorizedBand(bandId);

  if (!context) {
    return errorState(
      "You do not have permission to edit this band."
    );
  }

  const { supabase, band } = context;

  if (!band.logo_path) {
    return successState(
      "This band does not have a logo to remove."
    );
  }

  if (!band.logo_path.startsWith(`bands/${bandId}/`)) {
    return errorState(
      "The stored logo path is not valid for this band."
    );
  }

  const { data: changed, error: updateError } =
    await supabase
      .from("bands")
      .update({ logo_path: null })
      .eq("id", bandId)
      .eq("logo_path", band.logo_path)
      .select("id")
      .maybeSingle();

  if (updateError || !changed) {
    return errorState(
      "Unable to remove the logo reference. Refresh and try again."
    );
  }

  const { error: removeError } =
    await supabase.storage
      .from(BUCKET)
      .remove([band.logo_path]);

  if (removeError) {
    // The visible logo is already removed.
    // Log the remaining storage cleanup issue.
    console.error(
      "Logo storage cleanup:",
      removeError.message
    );
  }

  refreshBand(bandId, band.slug);

  return successState(
    "The band logo has been removed."
  );
}
