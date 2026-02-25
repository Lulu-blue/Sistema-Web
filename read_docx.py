import sys
import zipfile
import xml.dom.minidom

def get_docx_text(path):
    try:
        document = zipfile.ZipFile(path)
        xml_content = document.read('word/document.xml')
        document.close()
        tree = xml.dom.minidom.parseString(xml_content)
        paragraphs = []
        for paragraph in tree.getElementsByTagName('w:p'):
            texts = [node.firstChild.nodeValue for node in paragraph.getElementsByTagName('w:t') if node.firstChild]
            if texts:
                paragraphs.append(''.join(texts))
        return '\n'.join(paragraphs)
    except Exception as e:
        return str(e)

print('--- Auto 1 ---')
print(get_docx_text('Auto de Infração1.docx')[:800])
print('\n--- Auto 2 ---')
print(get_docx_text('Auto de Infração2.docx')[:800])
