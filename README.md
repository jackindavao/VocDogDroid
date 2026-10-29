# VocDog

A small, dependency-free vocabulary practice application for tab-delimited files.

Two versions are included:

- `vocdog.py`: the original Windows/Tkinter desktop application.
- `web/`: a touch-oriented, offline-capable Progressive Web App for Android and
  modern desktop browsers. See `ANDROID_INSTALL.md` for installation and TSV
  transfer instructions.

## Run

Python 3 with Tkinter is required (Tkinter is included with standard Windows Python):

```powershell
python vocdog.py
```

You can open a particular deck immediately:

```powershell
python vocdog.py foo.tsv
```

Without an argument, VocDog reopens the last successfully opened file when it is still available.

Open a TSV file, indicate whether its first row contains headings, choose **Fields…** if you want to change the prompt and answer columns, then press **Start / Resume**.

- `Enter` reveals the answer.
- After revealing, `Enter` moves the item to the end.
- After revealing, `1` through `9` reinserts it approximately 10% through 90% of the remaining deck.
- After revealing, `0` ejects the item from the current practice cycle without removing it from the saved deck.
- **Stop** preserves the exact current order.
- **Range…** selects a contiguous part of the current deck order for practice; `all` selects everything.
- **Randomize** stops and shuffles the active practice range.
- **Reset** reactivates every ejected item in the current range, ready for another run.
- **Swap Q/A** immediately reverses the prompt and answer fields.
- **View All** shows the mapped prompt field for the full deck, one item per line.
- **Save As…** writes unchanged rows in their current order.

The field-selection dialog changes only how items are displayed; it never rearranges TSV columns.
The large prompt and answer boxes are editable. Edits are committed automatically when revealing, scheduling, stopping, changing settings, saving, or exiting.
When a range is completed, VocDog displays the active practice time for that run; time spent stopped is excluded.

## Test

```powershell
python -m unittest -v
```

If Node.js is installed, test the browser-independent web deck model with:

```powershell
node --test web/test_deck.mjs
```
