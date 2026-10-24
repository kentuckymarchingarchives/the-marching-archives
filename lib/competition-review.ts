
import {
  organizationClasses,
} from "@/lib/competition-config";

export type ReviewSeverity =
  | "critical"
  | "warning"
  | "passed";

export type ReviewFinding = {
  severity: ReviewSeverity;
  title: string;
  detail: string;
  roundId?: string;
};

export type ReviewCompetition = {
  id: string;
  name: string;
  season_year: number;
  organization_code: string;
  competition_date: string | null;
  source_url: string | null;
  publication_status: string;
  archived_at: string | null;
};

export type ReviewRound = {
  id: string;
  name: string;
  class_scope: string | null;
  archived_at: string | null;
};

export type ReviewEntry = {
  id: string;
  band_id: string;
  round_id: string;
  classification: string | null;
  total_score: number | null;
  class_placement: number | null;
  overall_placement: number | null;
};

export type ReviewBand = {
  id: string;
  name: string;
  archived_at: string | null;
};

export type ReviewCaption = {
  id: string;
  round_id: string;
  name: string;
  max_score: number;
};

export type ReviewCaptionScore = {
  entry_id: string;
  caption_id: string;
  score: number;
};

export type ReviewInput = {
  competition: ReviewCompetition;
  rounds: ReviewRound[];
  entries: ReviewEntry[];
  bands: ReviewBand[];
  captions: ReviewCaption[];
  captionScores: ReviewCaptionScore[];
  truncated: boolean;
};

export function analyzeCompetition(
  input: ReviewInput
): ReviewFinding[] {
  const {
    competition,
    rounds,
    entries,
    bands,
    captions,
    captionScores,
    truncated,
  } = input;

  const findings: ReviewFinding[] = [];

  function add(
    severity: ReviewSeverity,
    title: string,
    detail: string,
    roundId?: string
  ) {
    findings.push({
      severity,
      title,
      detail,
      roundId,
    });
  }

  // Competition-level checks.

  if (truncated) {
    add(
      "critical",
      "Review exceeds the current data limit",
      "Not every database record was loaded. The review cannot be considered complete."
    );
  } else {
    add(
      "passed",
      "Review records loaded",
      "The requested competition records were loaded without exceeding the review limits."
    );
  }

  if (competition.archived_at) {
    add(
      "critical",
      "Competition is archived",
      "Restore this competition before considering it for publication."
    );
  } else {
    add(
      "passed",
      "Competition is not archived",
      "The competition is available in the active management system."
    );
  }

  if (!competition.name.trim()) {
    add(
      "critical",
      "Competition name is missing",
      "Add a descriptive competition name."
    );
  } else {
    add(
      "passed",
      "Competition has a name",
      "The competition has an identifying name."
    );
  }

  if (!competition.competition_date) {
    add(
      "warning",
      "Competition date is missing",
      "Confirm the event date from a reliable historical source."
    );
  } else {
    add(
      "passed",
      "Competition date recorded",
      "A competition date is present."
    );

    if (
      Number(competition.competition_date.slice(0, 4)) !==
      Number(competition.season_year)
    ) {
      add(
        "warning",
        "Date and season year differ",
        "This may be valid for some events, but verify the season assignment."
      );
    }
  }

  if (!competition.source_url) {
    add(
      "warning",
      "No source URL recorded",
      "Record the official results source when available. Offline historical sources may be documented separately."
    );
  } else {
    add(
      "passed",
      "Source URL recorded",
      "A source link is present. Its accuracy still requires manual verification."
    );
  }

  const activeRounds = rounds.filter(
    (round) => !round.archived_at
  );

  const archivedRounds = rounds.filter(
    (round) => Boolean(round.archived_at)
  );

  if (activeRounds.length === 0) {
    add(
      "critical",
      "No active competition rounds",
      "Add or restore at least one competition round."
    );
  } else {
    add(
      "passed",
      "Competition rounds exist",
      `${activeRounds.length} active round(s) found.`
    );
  }

  if (archivedRounds.length > 0) {
    add(
      "warning",
      "Competition has archived rounds",
      `${archivedRounds.length} archived round(s) will not be included in this publication review.`
    );
  }

  const bandMap = new Map(
    bands.map((band) => [band.id, band])
  );

  const scoresByEntry = new Map<
    string,
    ReviewCaptionScore[]
  >();

  for (const score of captionScores) {
    const existing =
      scoresByEntry.get(score.entry_id) ?? [];

    existing.push(score);
    scoresByEntry.set(score.entry_id, existing);
  }

  const validClasses = organizationClasses(
    competition.organization_code
  );

  for (const round of activeRounds) {
    const roundEntries = entries.filter(
      (entry) => entry.round_id === round.id
    );

    const roundCaptions = captions.filter(
      (caption) => caption.round_id === round.id
    );

    const captionMap = new Map(
      roundCaptions.map((caption) => [
        caption.id,
        caption,
      ])
    );

    if (roundEntries.length === 0) {
      add(
        "critical",
        "No entries recorded",
        `${round.name} has no participating bands or corps.`,
        round.id
      );
      continue;
    }

    add(
      "passed",
      "Round contains entries",
      `${roundEntries.length} ensemble(s) recorded for ${round.name}.`,
      round.id
    );

    const bandIds = new Set<string>();
    let unknownClass = 0;
    let missingResults = 0;
    let incompleteCaptions = 0;
    let missingTotals = 0;
    let missingPlacements = 0;
    let archivedBands = 0;
    let missingBands = 0;
    let incorrectClassScope = 0;
    let invalidClass = 0;
    let invalidCaptionScores = 0;
    let duplicateEntries = 0;

    const ranks = new Map<number, number>();

    for (const entry of roundEntries) {
      if (bandIds.has(entry.band_id)) {
        duplicateEntries++;
      }

      bandIds.add(entry.band_id);

      const band = bandMap.get(entry.band_id);

      if (!band) {
        missingBands++;
      } else if (band.archived_at) {
        archivedBands++;
      }

      if (!entry.classification) {
        unknownClass++;
      } else if (
        !validClasses.includes(entry.classification)
      ) {
        invalidClass++;
      }

      if (
        round.class_scope &&
        entry.classification !== round.class_scope
      ) {
        incorrectClassScope++;
      }

      const hasScore = entry.total_score !== null;

      const hasPlacement =
        entry.class_placement !== null ||
        entry.overall_placement !== null;

      if (!hasScore && !hasPlacement) {
        missingResults++;
      } else {
        if (!hasScore) missingTotals++;
        if (!hasPlacement) missingPlacements++;
      }

      if (entry.overall_placement !== null) {
        const rank = Number(entry.overall_placement);

        ranks.set(
          rank,
          (ranks.get(rank) ?? 0) + 1
        );
      }

      const savedScores =
        scoresByEntry.get(entry.id) ?? [];

      if (roundCaptions.length > 0) {
        const present = new Set(
          savedScores.map((score) => score.caption_id)
        );

        if (
          roundCaptions.some(
            (caption) => !present.has(caption.id)
          )
        ) {
          incompleteCaptions++;
        }
      }

      for (const score of savedScores) {
        const caption = captionMap.get(
          score.caption_id
        );

        if (
          !caption ||
          !Number.isFinite(Number(score.score)) ||
          Number(score.score) < 0 ||
          Number(score.score) >
            Number(caption.max_score)
        ) {
          invalidCaptionScores++;
        }
      }
    }

    if (duplicateEntries > 0) {
      add(
        "critical",
        "Duplicate band entries",
        `${duplicateEntries} duplicate participation record(s) found in ${round.name}.`,
        round.id
      );
    }

    if (missingBands > 0) {
      add(
        "critical",
        "Missing band profiles",
        `${missingBands} entry or entries reference bands that could not be found.`,
        round.id
      );
    }

    if (archivedBands > 0) {
      add(
        "critical",
        "Archived bands in active results",
        `${archivedBands} entry or entries reference archived ensembles.`,
        round.id
      );
    }

    if (invalidClass > 0) {
      add(
        "critical",
        "Invalid classifications",
        `${invalidClass} entry or entries use classifications outside this organization's defined list.`,
        round.id
      );
    }

    if (incorrectClassScope > 0) {
      add(
        "critical",
        "Round classification mismatch",
        `${incorrectClassScope} entry or entries do not match the round's restricted class.`,
        round.id
      );
    }

    if (invalidCaptionScores > 0) {
      add(
        "critical",
        "Invalid caption scores",
        `${invalidCaptionScores} caption score(s) are outside their configured range or belong to another round.`,
        round.id
      );
    }

    if (missingResults > 0) {
      add(
        "warning",
        "Entries without results",
        `${missingResults} ensemble(s) have neither a reported score nor a placement.`,
        round.id
      );
    }

    if (missingTotals > 0) {
      add(
        "warning",
        "Missing total scores",
        `${missingTotals} ensemble(s) have placement information but no total score.`,
        round.id
      );
    }

    if (missingPlacements > 0) {
      add(
        "warning",
        "Missing placements",
        `${missingPlacements} ensemble(s) have a total score but no placement.`,
        round.id
      );
    }

    if (unknownClass > 0) {
      add(
        "warning",
        "Unclassified entries",
        `${unknownClass} entry or entries have no classification. This may be appropriate for exhibition performances.`,
        round.id
      );
    }

    if (incompleteCaptions > 0) {
      add(
        "warning",
        "Incomplete caption breakdowns",
        `${incompleteCaptions} ensemble(s) do not have every configured caption score.`,
        round.id
      );
    }

    if (roundCaptions.length === 0) {
      add(
        "warning",
        "No scoring captions configured",
        `The ${round.name} round has no caption definitions. This is acceptable if only total scores or placements are documented.`,
        round.id
      );
    }

    const ties = [...ranks.values()].filter(
      (count) => count > 1
    ).length;

    if (ties > 0) {
      add(
        "warning",
        "Shared overall placements",
        `${ties} overall placement position(s) are shared. Check the official tie and ranking rules.`,
        round.id
      );
    }

    const hasCritical = findings.some(
      (finding) =>
        finding.roundId === round.id &&
        finding.severity === "critical"
    );

    if (!hasCritical) {
      add(
        "passed",
        "No structural errors found",
        `${round.name} passed its structural result checks. This does not verify the numbers against official results.`,
        round.id
      );
    }
  }

  if (
    activeRounds.length > 0 &&
    activeRounds.every((round) => {
      const roundEntries = entries.filter(
        (entry) => entry.round_id === round.id
      );

      return roundEntries.some(
        (entry) =>
          entry.total_score !== null ||
          entry.class_placement !== null ||
          entry.overall_placement !== null
      );
    })
  ) {
    add(
      "passed",
      "Every active round has result data",
      "At least one recorded performance result exists in each active round."
    );
  } else if (activeRounds.length > 0) {
    add(
      "critical",
      "Some rounds contain no result data",
      "Each active round needs at least one recorded score or placement before publication review can be considered complete."
    );
  }

  return findings;
}
