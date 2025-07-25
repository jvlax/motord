import json

INPUT_FILE = 'backend/wordlists/efllex_wordlist_translated.jsonl'
THRESHOLD = 0.01  # Frequency threshold to consider as 'close to 0'

# Skip header line
def is_low_freq(cefr_freq):
    return all(float(cefr_freq.get(level, 0)) <= THRESHOLD for level in ['a1', 'a2', 'b1', 'b2', 'c1'])

def main():
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        header = f.readline()
        for line in f:
            entry = json.loads(line)
            cefr_freq = entry.get('metadata', {}).get('cefr_freq', {})
            if is_low_freq(cefr_freq):
                print(json.dumps({
                    'word': entry.get('word'),
                    'cefr_freq': cefr_freq,
                    'difficulty': entry.get('difficulty'),
                    'pos': entry.get('metadata', {}).get('pos'),
                    'translation_fr': entry.get('translation_fr'),
                    'translation_sv': entry.get('translation_sv')
                }, ensure_ascii=False))

if __name__ == '__main__':
    main() 