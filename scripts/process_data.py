import csv
import json
import os
import asyncio
import edge_tts
import hashlib

# Configuration
SOURCE_FILES = {
    "beginner": "法语词汇渐进（初级）.csv",
    "intermediate": "法语词汇渐进词汇表（中级）.csv"
}
DATA_DIR = "data"
AUDIO_DIR = "audio"
VOICE = "fr-FR-DeniseNeural"

async def generate_speech(text, output_path):
    if os.path.exists(output_path):
        return
    
    communicate = edge_tts.Communicate(text, VOICE)
    await communicate.save(output_path)
    print(f"Generated audio for: {text}")

import re
import unicodedata

def sanitize_filename(text):
    # Normalize unicode characters to remove accents
    text = unicodedata.normalize('NFD', text)
    text = "".join([c for c in text if not unicodedata.combining(c)])
    # Convert to lowercase and replace non-alphanumeric with underscore
    text = text.lower()
    text = re.sub(r'[^a-z0-9_-]', '_', text)
    # Remove multiple underscores
    text = re.sub(r'_+', '_', text).strip('_')
    return text

async def process_csv(name, path):
    print(f"Processing {name} ({path})...")
    items = []
    
    if not os.path.exists(path):
        print(f"Error: File {path} not found.")
        return

    with open(path, mode='r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            def safe_get(row, key):
                val = row.get(key, "")
                return val.strip() if val else ""

            word = safe_get(row, 'Word')
            if not word:
                continue

            item = {
                "word": word,
                "type": safe_get(row, 'Type'),
                "meaning": safe_get(row, 'Meaning'),
                "page": safe_get(row, 'Page'),
                # Use sanitized word as ID/Filename
                "id": sanitize_filename(word)
            }
            # Handle duplicates by adding a suffix if needed
            base_id = item['id']
            suffix = 1
            while any(i['id'] == item['id'] for i in items):
                item['id'] = f"{base_id}_{suffix}"
                suffix += 1

            audio_filename = f"{item['id']}.mp3"
            item['audio'] = f"audio/{audio_filename}"
            items.append(item)

    # Save JSON
    json_path = os.path.join(DATA_DIR, f"{name}.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    
    print(f"Saved {len(items)} items to {json_path}")
    return items

async def main(limit=None):
    all_items = []
    for name, path in SOURCE_FILES.items():
        items = await process_csv(name, path)
        if items:
            all_items.extend(items)
    
    print("Generating audio files...")
    # To avoid rate limits and too many concurrent connections, we do them in batches or sequentially
    # For initial testing, we might want a limit
    count = 0
    for item in all_items:
        if limit and count >= limit:
            break
        
        word = item['word']
        output_path = os.path.join(AUDIO_DIR, os.path.basename(item['audio']))
        
        try:
            await generate_speech(word, output_path)
            count += 1
        except Exception as e:
            print(f"Error generating audio for {word}: {e}")
        
    print(f"Finished. Generated {count} audio files.")

if __name__ == "__main__":
    # For now, let's just generate a few to test
    import sys
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    asyncio.run(main(limit=limit))
