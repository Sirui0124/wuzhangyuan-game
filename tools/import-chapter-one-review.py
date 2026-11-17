"""Read the user-exported Feishu workbook; never modifies the cloud source."""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

root = Path(__file__).resolve().parents[1]
source = Path.home() / 'Downloads' / '第一章【文案策划】_待定_2610212211.xlsx'
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(source) as archive:
    strings = [''.join(item.itertext()) for item in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('s:si', ns)]
    def rows(name):
        result = []
        for row in ET.fromstring(archive.read(name)).findall('.//s:sheetData/s:row', ns):
            cells = [''] * 5
            for cell in row.findall('s:c', ns):
                column = ''.join(c for c in cell.attrib['r'] if c.isalpha())
                index = 0
                for c in column:
                    index = index * 26 + ord(c) - 64
                value = cell.find('s:v', ns)
                if index <= 5 and value is not None:
                    cells[index - 1] = strings[int(value.text)] if cell.get('t') == 's' else value.text
            if cells[0]:
                result.append(cells)
        return result
    data = {
        'version': 'ch1-review-2610212218-v1',
        'source_url': 'https://my.feishu.cn/sheets/WtGwsSisshygCat8XkBc96oCnll',
        'mechanism_url': 'https://my.feishu.cn/docx/ZONrd2zvrojTmrxZ7SscahWkncb',
        'chapter_rules_url': 'https://my.feishu.cn/docx/LgDHd18g6oBjD5xJ1DfcwDODn5e',
        'novel_url': 'https://my.feishu.cn/docx/KqSkdDKAgoNeRhxpah5cT4EAnkh',
        'retrieved': '2026-10-21', 'workbook_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'rows': [dict(zip(['id', 'speaker', 'text', 'clue', 'transition'], row)) for row in rows('xl/worksheets/sheet2.xml')[1:]],
        'clues': [dict(zip(['id', 'kind', 'summary', 'collect', 'boundary'], row)) for row in rows('xl/worksheets/sheet3.xml')[1:]],
        'rules': [dict(zip(['id', 'kind', 'summary', 'input', 'contract'], row)) for row in rows('xl/worksheets/sheet4.xml')[1:]],
    }
ids = [row['id'] for row in data['rows']]
assert len(ids) == len(set(ids))
destination = root / 'content/chapters/wuzhang/chapter-one.script.json'
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Imported {len(ids)} script rows, {len(data["clues"])} clues, {len(data["rules"])} rules')
