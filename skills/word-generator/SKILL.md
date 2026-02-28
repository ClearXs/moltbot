---
name: word-generator
description: "生成 Word (.docx) 文档。使用场景：(1) 用户需要创建 Word 文档，(2) 报告、合同、简历等，(3) 需要下载为 .docx 格式。不用于：简单的 Markdown 转换（用 markdown-converter）、创建表格文档（用 excel-generator）。"
---

# Word 文档生成器

使用 python-docx 库创建和编辑 Word (.docx) 文档。

## 何时使用

当用户需要生成 Word 文档时使用此技能，包括：

- 创建报告、文档
- 生成合同、协议
- 制作简历
- 创建信函、备忘录
- 任何需要 .docx 格式的场景

## 依赖

需要安装 python-docx：

```bash
pip install python-docx
```

## 基本用法

### 创建文档

```python
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

# 创建文档
doc = Document()

# 添加标题
doc.add_heading('文档标题', 0)

# 添加段落
doc.add_paragraph('这是一个段落')

# 添加加粗文本
p = doc.add_paragraph()
p.add_run('加粗文本').bold = True

# 添加斜体
p.add_run('斜体文本').italic = True

# 添加超链接
link = doc.add_paragraph()
run = link.add_run('点击这里')
run.hyperlink = 'https://example.com'

# 添加列表
doc.add_paragraph('第一项', style='List Bullet')
doc.add_paragraph('第二项', style='List Number')

# 添加页面分隔
doc.add_page_break()

# 保存文档
doc.save('output.docx')
```

### 添加表格

```python
# 添加表格
table = doc.add_table(rows=2, cols=3)
table.style = 'Light Grid Accent 1'

# 填充数据
row = table.rows[0]
row.cells[0].text = '列1'
row.cells[1].text = '列2'
row.cells[2].text = '列3'
```

### 设置样式

```python
from docx.shared import Inches

# 设置段落间距
paragraph = doc.add_paragraph('文本')
paragraph.paragraph_format.space_before = Pt(12)
paragraph.paragraph_format.space_after = Pt(12)

# 设置字体
run = paragraph.add_run('指定字体')
run.font.name = 'Arial'
run.font.size = Pt(12)

# 设置颜色
run.font.color.rgb = RGBColor(255, 0, 0)

# 设置对齐
paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
```

### 添加图片

```python
# 添加图片
doc.add_picture('image.png', width=Inches(2))

# 设置图片位置
last_paragraph = doc.paragraphs[-1]
last_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
```

### 添加页眉页脚

```python
# 添加页眉
section = doc.sections[0]
header = section.header
header_paragraph = header.paragraphs[0]
header_paragraph.text = "页眉文本"

# 添加页脚
footer = section.footer
footer_paragraph = footer.paragraphs[0]
footer_paragraph.text = "页脚文本 - 第"
```

## 输出

- 所有生成的文档保存到当前工作目录
- 文件名应为描述性名称（如 `report.docx`, `resume.docx`）
- 完成后告知用户文件路径

## 注意事项

- 确保内容适合 Word 格式
- 复杂格式建议使用模板
- 大量数据建议生成分章节的文档
