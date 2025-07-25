import csv
import json

# Mapping from CEFR level to difficulty
CEFR_TO_DIFFICULTY = {
    'a1': 0,  # very easy
    'a2': 1,  # easy
    'b1': 2,  # medium
    'b2': 3,  # hard
    'c1': 4,  # very hard
}

LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1']

INPUT_FILE = 'backend/wordlists/EFLLex_NLP4J.tsv'
OUTPUT_FILE = 'backend/wordlists/efllex_wordlist.jsonl'

HEADER = {
    "description": "Auto-generated wordlist from EFLLex. Fields: word, difficulty (0=very easy, 4=very hard), metadata (POS-tag, CEFR frequencies).",
    "source": "https://cental.uclouvain.be/cefrlex/efllex/",
    "difficulty_mapping": CEFR_TO_DIFFICULTY,
    "fields": ["word", "difficulty", "metadata"]
}

def assign_difficulty(row):
    # Assign the lowest CEFR level with nonzero frequency as the difficulty
    for level in LEVELS:
        freq = float(row.get(f'level_freq@{level}', 0))
        if freq > 0:
            return CEFR_TO_DIFFICULTY[level]
    return 4  # Default to hardest if no frequency found

def main():
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as out_f:
        out_f.write(json.dumps({"header": HEADER}) + '\n')
        with open(INPUT_FILE, 'r', encoding='utf-8') as in_f:
            reader = csv.DictReader(in_f, delimiter='\t')
            for row in reader:
                word = row['word']
                tag = row['tag']
                difficulty = assign_difficulty(row)
                metadata = {
                    "pos": tag,
                    "cefr_freq": {level: float(row.get(f'level_freq@{level}', 0)) for level in LEVELS}
                }
                out_f.write(json.dumps({
                    "word": word,
                    "difficulty": difficulty,
                    "metadata": metadata
                }, ensure_ascii=False) + '\n')

if __name__ == '__main__':
    main() 