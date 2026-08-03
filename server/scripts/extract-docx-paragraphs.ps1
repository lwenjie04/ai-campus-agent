param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.IO.Compression.FileSystem

$zip = [System.IO.Compression.ZipFile]::OpenRead($InputPath)
try {
  $entry = $zip.GetEntry('word/document.xml')
  if (-not $entry) {
    throw "word/document.xml not found"
  }

  $stream = $entry.Open()
  try {
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
    try {
      $xmlText = $reader.ReadToEnd()
    } finally {
      $reader.Dispose()
    }
  } finally {
    $stream.Dispose()
  }

  [xml]$doc = $xmlText
  $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
  $ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')

  $paragraphs = New-Object 'System.Collections.Generic.List[string]'
  $paragraphNodes = $doc.SelectNodes('//w:p', $ns)

  foreach ($paragraph in $paragraphNodes) {
    $parts = New-Object 'System.Collections.Generic.List[string]'
    foreach ($node in $paragraph.SelectNodes('.//w:t', $ns)) {
      if ($null -ne $node.InnerText) {
        [void]$parts.Add($node.InnerText)
      }
    }

    $text = ($parts -join '').Trim()
    if ($text) {
      [void]$paragraphs.Add($text)
    }
  }

  $payload = @{
    input = $InputPath
    paragraphs = $paragraphs
  }

  $payload | ConvertTo-Json -Depth 3 -Compress
} finally {
  $zip.Dispose()
}
