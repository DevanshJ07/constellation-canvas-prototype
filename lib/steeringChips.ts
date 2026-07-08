/**
 * Story-specific steering chip suggestions (Phase 6E).
 */

export type SteeringChipContext = {
  worldSeed: string;
  nodeTitle?: string;
  nodeDescription?: string;
  category?: string;
};

function seedHints(seed: string) {
  const s = seed.toLowerCase();
  return {
    cave: /\bcave|caves|underground\b/.test(s),
    memory: /\bmemory|memories|remember\b/.test(s),
    friends: /\bfriend|friends|group\b/.test(s),
    temple: /\btemple|ritual|shrine|god|lady\b/.test(s),
    horror: /\bhorror|haunt|fear|nightmare\b/.test(s),
    mystery: /\bmystery|detective|locked.?room|murder\b/.test(s),
    sports: /\bsport|team|match|game|penalty\b/.test(s),
    inheritance: /\binherit|estate|family|will\b/.test(s),
    sciFi: /\bsci.?fi|colony|data|surveillance|economy\b/.test(s),
    underwater: /\bunderwater|ocean|sea|dive\b/.test(s),
  };
}

export function buildSteeringChips(ctx: SteeringChipContext): string[] {
  const hints = seedHints(ctx.worldSeed);
  const title = (ctx.nodeTitle ?? "").toLowerCase();
  const desc = (ctx.nodeDescription ?? "").toLowerCase();
  const chips: string[] = [];

  if (hints.cave || /cave/.test(title)) {
    chips.push("Make the cave distort memory, not reality");
    chips.push("Let only one friend hear the warning");
    chips.push("Tie this to a childhood mistake");
  }

  if (hints.temple || /temple|ritual|shrine/.test(title)) {
    chips.push("Make the temple seem protective at first");
    chips.push("Turn the rule into a moral choice");
    chips.push("Hide the true cost inside a blessing");
  }

  if (hints.memory || hints.sciFi || /memory|data|debt/.test(title)) {
    chips.push("Make the stolen memory feel morally explosive");
    chips.push("Let someone trade a memory they cannot afford to lose");
  }

  if (hints.horror || /fear|nightmare|dream/.test(title + desc)) {
    chips.push("Keep the horror uncertain — haunted, manipulated, or self-inflicted?");
    chips.push("Make fear spread through the group, not through a monster");
  }

  if (hints.mystery) {
    chips.push("Hide the clue in something everyone misreads");
    chips.push("Make the suspect seem helpful at first");
  }

  if (hints.sports) {
    chips.push("Make the team split over loyalty, not talent");
    chips.push("Turn the next match into a personal reckoning");
  }

  if (hints.inheritance) {
    chips.push("Reveal a secret gift that looks like a punishment");
    chips.push("Make one heir protect a lie for love");
  }

  if (hints.underwater) {
    chips.push("This happens underwater — pressure changes every choice");
    chips.push("Make communication fail in a life-or-death moment");
  }

  if (chips.length < 3) {
    chips.push("Raise the emotional cost before the plot cost");
    chips.push("Make the safest choice feel like betrayal");
    chips.push("Give this path one secret the world is hiding");
  }

  const unique = [...new Set(chips)];
  return unique.slice(0, 5);
}
