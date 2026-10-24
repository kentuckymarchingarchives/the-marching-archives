
"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  UUID_PATTERN,
  validateBandFields,
  validateHistoricalName,
} from "@/lib/band-validation";

import { validateCustomBandSlug } from "@/lib/band-slugs";

const MAX_LOGO_SIZE = 2 * 1024 * 1024;

async function requireStaff() {
  const supabase = await createClient();

  const { data: auth, error: authError } =
    await supabase.auth.getClaims();

  const userId = auth?.claims?.sub;

  if (authError || !userId) {
    redirect("/staff/login");
  }

  const { data: staff, error: staffError } =
    await supabase
      .from("staff_members")
      .select("role, status")
      .eq("user_id", userId)
      .maybeSingle();

  if (
    staffError ||
    !staff ||
    staff.status !== "active" ||
    !["owner", "admin", "editor"].includes(staff.role)
  ) {
    throw new Error(
      "You do not have permission to manage bands."
    );
  }

  return supabase;
}

function getId(formData: FormData, key: string) {
  const value = formData.get(key);

  if (
    typeof value !== "string" ||
    !UUID_PATTERN.test(value)
  ) {
    throw new Error("Invalid record identifier.");
  }

  return value;
}

type LogoFile = {
  buffer: Buffer;
  extension: "png" | "jpg" | "webp";
  mimeType: string;
};

async function readOptionalLogo(
  formData: FormData
): Promise<LogoFile | null> {
  const input = formData.get("logo");

  if (!input || !(input instanceof File)) {
    return null;
  }

  if (input.size === 0) {
    return null;
  }

  if (input.size > MAX_LOGO_SIZE) {
    throw new Error(
      "The logo must be 2 MB or smaller."
    );
  }

  if (
    !["image/png", "image/jpeg", "image/webp"]
      .includes(input.type)
  ) {
    throw new Error(
      "Only PNG, JPEG, and WebP logos are supported."
    );
  }

  const buffer = Buffer.from(await input.arrayBuffer());

  let extension: LogoFile["extension"] | null = null;

  if (
    input.type === "image/png" &&
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    )
  ) {
    extension = "png";
  } else if (
    input.type === "image/jpeg" &&
    buffer.length >= 3 &&
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[2] === 255
  ) {
    extension = "jpg";
  } else if (
    input.type === "image/webp" &&
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    extension = "webp";
  }

  if (!extension) {
    throw new Error(
      "The uploaded file does not have a valid image signature."
    );
  }

  return {
    buffer,
    extension,
    mimeType: input.type,
  };
}

export async function createBand(formData: FormData) {
  const supabase = await requireStaff();

  const values = validateBandFields(formData);
  const logo = await readOptionalLogo(formData);

  const rawSlug = formData.get("slug");

  if (
    rawSlug !== null &&
    typeof rawSlug !== "string"
  ) {
    throw new Error("Invalid custom band URL.");
  }

  const customSlug = validateCustomBandSlug(
    rawSlug ?? ""
  );

  const insertValues = {
    ...values,
    ...(customSlug ? { slug: customSlug } : {}),
  };

  const { data, error } = await supabase
    .from("bands")
    .insert(insertValues)
    .select("id, slug")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new Error(
        "That band URL is already in use. Choose another custom URL."
      );
    }

    console.error("Create band:", error?.message);

    throw new Error("Unable to create band.");
  }

  let logoFailed = false;

  if (logo) {
    const objectPath =
      `bands/${data.id}/${randomUUID()}.${logo.extension}`;

    try {
      const { error: uploadError } =
        await supabase.storage
          .from("band-logos")
          .upload(objectPath, logo.buffer, {
            contentType: logo.mimeType,
            cacheControl: "3600",
            upsert: false,
          });

      if (uploadError) {
        console.error(
          "New band logo upload:",
          uploadError.message
        );

        logoFailed = true;
      } else {
        const { data: updated, error: updateError } =
          await supabase
            .from("bands")
            .update({ logo_path: objectPath })
            .eq("id", data.id)
            .select("id")
            .maybeSingle();

        if (updateError || !updated) {
          console.error(
            "New band logo reference:",
            updateError?.message
          );

          logoFailed = true;

          const { error: cleanupError } =
            await supabase.storage
              .from("band-logos")
              .remove([objectPath]);

          if (cleanupError) {
            console.error(
              "Failed logo cleanup:",
              cleanupError.message
            );
          }
        }
      }
    } catch (uploadException) {
      console.error(
        "Unexpected logo upload failure:",
        uploadException
      );
      logoFailed = true;
    }
  }

  revalidatePath("/staff/bands");
  revalidatePath("/bands");
  revalidatePath(`/bands/${data.slug}`);
  revalidatePath(`/staff/bands/${data.id}`);

  if (logoFailed) {
    redirect(
      `/staff/bands/${data.id}?created=1&logo_error=1#band-logo`
    );
  }

  redirect(
    `/staff/bands/${data.id}?created=1#band-logo`
  );
}

export async function updateBand(formData: FormData) {
  const supabase = await requireStaff();
  const bandId = getId(formData, "band_id");
  const values = validateBandFields(formData);

  const { data, error } = await supabase
    .from("bands")
    .update(values)
    .eq("id", bandId)
    .select("id, slug")
    .single();

  if (error || !data) {
    console.error("Update band:", error?.message);
    throw new Error("Unable to update band.");
  }

  revalidatePath("/staff/bands");
  revalidatePath(`/staff/bands/${bandId}`);
  revalidatePath("/bands");
  revalidatePath(`/bands/${data.slug}`);

  redirect(`/staff/bands/${bandId}?saved=1`);
}

export async function addHistoricalName(
  formData: FormData
) {
  const supabase = await requireStaff();
  const bandId = getId(formData, "band_id");
  const values = validateHistoricalName(formData);

  const { data: band, error: bandError } =
    await supabase
      .from("bands")
      .select("id, slug")
      .eq("id", bandId)
      .maybeSingle();

  if (bandError || !band) {
    throw new Error("Band not found.");
  }

  const { error } = await supabase
    .from("band_names")
    .insert({
      band_id: bandId,
      ...values,
    });

  if (error) {
    console.error(
      "Add historical name:",
      error.message
    );

    throw new Error("Unable to add historical name.");
  }

  revalidatePath(`/staff/bands/${bandId}`);
  revalidatePath(`/bands/${band.slug}`);

  redirect(`/staff/bands/${bandId}?name_added=1`);
}

export async function removeHistoricalName(
  formData: FormData
) {
  const supabase = await requireStaff();

  const bandId = getId(formData, "band_id");
  const nameId = getId(formData, "name_id");

  const { data: band } = await supabase
    .from("bands")
    .select("slug")
    .eq("id", bandId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("band_names")
    .delete()
    .eq("id", nameId)
    .eq("band_id", bandId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      "Historical name not found or could not be removed."
    );
  }

  revalidatePath(`/staff/bands/${bandId}`);

  if (band?.slug) {
    revalidatePath(`/bands/${band.slug}`);
  }

  redirect(
    `/staff/bands/${bandId}?name_removed=1`
  );
}
