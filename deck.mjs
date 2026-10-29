export class VocabularyItem {
  constructor(fields, rawLine = null, dirty = false) {
    this.fields = [...fields];
    this.rawLine = rawLine ?? fields.join("\t");
    this.dirty = dirty;
  }

  setField(index, value) {
    while (this.fields.length <= index) this.fields.push("");
    if (this.fields[index] !== value) {
      this.fields[index] = value;
      this.dirty = true;
    }
  }

  value(index) {
    return this.fields[index] ?? "";
  }
}

export class Deck {
  constructor(items) {
    this.prefix = [];
    this.items = [...items];
    this.ejected = [];
    this.suffix = [];
    this.active = null;
    this.rangeStart = 1;
    this.rangeEnd = items.length;
  }

  get totalCount() {
    return this.prefix.length + this.items.length + this.ejected.length +
      this.suffix.length + (this.active ? 1 : 0);
  }

  get activeCount() {
    return this.items.length + (this.active ? 1 : 0);
  }

  takeNext() {
    if (!this.active && this.items.length) this.active = this.items.shift();
    return this.active;
  }

  restoreActive() {
    if (this.active) {
      this.items.unshift(this.active);
      this.active = null;
    }
  }

  scheduleActive(rating = null) {
    if (!this.active) return;
    const item = this.active;
    this.active = null;
    if (rating === null) {
      this.items.push(item);
      return;
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 9) {
      throw new RangeError("Rating must be an integer from 1 through 9.");
    }
    const index = Math.round((rating / 10) * this.items.length);
    this.items.splice(index, 0, item);
  }

  ejectActive() {
    if (this.active) {
      this.ejected.push(this.active);
      this.active = null;
    }
  }

  resetRange() {
    this.restoreActive();
    this.items.push(...this.ejected);
    this.ejected = [];
  }

  shuffle(random = Math.random) {
    this.restoreActive();
    for (let i = this.items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [this.items[i], this.items[j]] = [this.items[j], this.items[i]];
    }
  }

  snapshot() {
    return [
      ...this.prefix,
      ...(this.active ? [this.active] : []),
      ...this.items,
      ...this.ejected,
      ...this.suffix,
    ];
  }

  orderedItems() {
    this.restoreActive();
    return [...this.prefix, ...this.items, ...this.ejected, ...this.suffix];
  }

  setRange(start, end) {
    const all = this.orderedItems();
    if (!Number.isInteger(start) || !Number.isInteger(end) ||
        start < 1 || end < start || end > all.length) {
      throw new RangeError(`Choose a range from 1 to ${all.length}.`);
    }
    this.prefix = all.slice(0, start - 1);
    this.items = all.slice(start - 1, end);
    this.ejected = [];
    this.suffix = all.slice(end);
    this.rangeStart = start;
    this.rangeEnd = end;
  }

  toJSON() {
    return {
      prefix: this.prefix,
      items: this.items,
      ejected: this.ejected,
      suffix: this.suffix,
      active: this.active,
      rangeStart: this.rangeStart,
      rangeEnd: this.rangeEnd,
    };
  }

  static fromJSON(data) {
    const revive = (value) => value ? new VocabularyItem(value.fields, value.rawLine, value.dirty) : null;
    const deck = new Deck([]);
    deck.prefix = (data.prefix ?? []).map(revive);
    deck.items = (data.items ?? []).map(revive);
    deck.ejected = (data.ejected ?? []).map(revive);
    deck.suffix = (data.suffix ?? []).map(revive);
    deck.active = revive(data.active);
    deck.rangeStart = data.rangeStart ?? 1;
    deck.rangeEnd = data.rangeEnd ?? deck.totalCount;
    return deck;
  }
}

export function parseTsv(text, hasHeader = false) {
  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") lines.pop();
  const header = hasHeader && lines.length ? lines.shift() : null;
  let skipped = 0;
  const items = [];
  for (const line of lines) {
    if (!line.trim()) {
      skipped += 1;
      continue;
    }
    items.push(new VocabularyItem(line.split("\t"), line));
  }
  return { header, items, skipped };
}

export function fieldLabels(items, header) {
  const width = Math.max(0, ...items.map((item) => item.fields.length));
  const headings = header === null ? [] : header.split("\t");
  return Array.from({ length: width }, (_, index) => {
    const name = headings[index]?.trim() || `Field ${index + 1}`;
    const preview = items.find((item) => item.value(index))?.value(index) || "empty";
    return `${name} — ${preview.slice(0, 45)}`;
  });
}
