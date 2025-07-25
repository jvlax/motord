import json
from collections import defaultdict

INPUT_FILE = 'efllex_wordlist_translated.jsonl'
OUTPUT_FILE = 'efllex_wordlist_merged.jsonl'

# Helper to merge alternates and translations

def merge_lists(*lists):
    seen = set()
    merged = []
    for lst in lists:
        for item in lst:
            if item not in seen:
                seen.add(item)
                merged.append(item)
    return merged

def normalize_lower(s):
    return s.lower() if isinstance(s, str) else s

def main():
    word_entries = defaultdict(list)
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        header = f.readline()
        for line in f:
            entry = json.loads(line)
            # Normalize word to lower case
            entry['word'] = normalize_lower(entry['word'])
            word_entries[entry['word']].append(entry)
    
    # Write header
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as out_f:
        out_f.write(header)
        for word, entries in word_entries.items():
            # Merge logic
            merged = dict(entries[0])
            # Difficulty: take the lowest
            merged['difficulty'] = min(e['difficulty'] for e in entries)
            
            # POS: merge unique
            pos_set = set()
            for e in entries:
                if 'metadata' in e and 'pos' in e['metadata']:
                    pos = e['metadata']['pos']
                    if isinstance(pos, list):
                        pos_set.update(pos)
                    else:
                        pos_set.add(pos)
            merged['metadata']['pos'] = list(pos_set) if len(pos_set) > 1 else next(iter(pos_set), None)
            
            # CEFR freq: take max for each level
            levels = ['a1', 'a2', 'b1', 'b2', 'c1']
            merged['metadata']['cefr_freq'] = {lvl: max(e['metadata']['cefr_freq'].get(lvl, 0) for e in entries if 'metadata' in e and 'cefr_freq' in e['metadata']) for lvl in levels}
            
            # Main translations and alternates: collect all unique translations
            for lang in ['fr', 'sv']:
                all_translations = []
                for e in entries:
                    translation = e.get(f'translation_{lang}', '')
                    if translation and translation.strip():
                        all_translations.append(normalize_lower(translation))
                
                # Remove duplicates while preserving order
                unique_translations = []
                seen = set()
                for t in all_translations:
                    if t not in seen:
                        seen.add(t)
                        unique_translations.append(t)
                
                if unique_translations:
                    # First translation becomes main, rest become alternates
                    main_translation = unique_translations[0]
                    alternates = unique_translations[1:] if len(unique_translations) > 1 else []
                    
                    merged[f'translation_{lang}'] = main_translation
                    if 'alternates' not in merged:
                        merged['alternates'] = {}
                    merged['alternates'][lang] = alternates
                else:
                    merged[f'translation_{lang}'] = ''
                    if 'alternates' not in merged:
                        merged['alternates'] = {}
                    merged['alternates'][lang] = []
            
            merged['word'] = normalize_lower(merged['word'])
            out_f.write(json.dumps(merged, ensure_ascii=False) + '\n')

if __name__ == '__main__':
    main() 