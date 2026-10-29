"""从官方模板包按 ZIP 区段下载 macOS 模板，避免下载其他平台的大文件。"""
from pathlib import Path
import io
import struct
import urllib.request
import zipfile
import zlib

URL = "https://github.com/godotengine/godot-builds/releases/download/4.5.1-stable/Godot_v4.5.1-stable_export_templates.tpz"
ROOT = Path(__file__).resolve().parents[1]


def fetch(byte_range):
    request = urllib.request.Request(URL, headers={"Range": f"bytes={byte_range}", "User-Agent": "TidalFishing-ResourceSetup/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        if response.status != 206:
            raise RuntimeError("Official server did not honor byte-range request")
        return response.read()


def main():
    request = urllib.request.Request(URL, method="HEAD")
    with urllib.request.urlopen(request, timeout=90) as response:
        size = int(response.headers["Content-Length"])
    tail = fetch(f"{size - 65536}-{size - 1}")
    end = tail.rfind(b"PK\x05\x06")
    if end < 0:
        raise RuntimeError("ZIP directory not found")
    record = struct.unpack_from("<4s4H2IH", tail, end)
    directory_size, directory_offset = record[5:7]
    directory = fetch(f"{directory_offset}-{directory_offset + directory_size - 1}")
    # 用原始中央目录建立只读索引，仅解析文件元数据。
    offset = 0
    while offset < len(directory):
        header = struct.unpack_from("<4s6H3I5H2I", directory, offset)
        if header[0] != b"PK\x01\x02":
            raise RuntimeError("Invalid ZIP central directory")
        method, compressed, name_len, extra_len, comment_len, local_offset = header[4], header[8], header[10], header[11], header[12], header[16]
        name = directory[offset + 46:offset + 46 + name_len].decode()
        if name == "templates/macos.zip":
            prefix = fetch(f"{local_offset}-{local_offset + 29}")
            local = struct.unpack("<4s5H3I2H", prefix)
            data_offset = local_offset + 30 + local[-2] + local[-1]
            data = fetch(f"{data_offset}-{data_offset + compressed - 1}")
            unpacked = zlib.decompress(data, -15) if method == 8 else data
            if zlib.crc32(unpacked) != header[7]:
                raise RuntimeError("Template CRC mismatch")
            with zipfile.ZipFile(io.BytesIO(unpacked)) as archive:
                if archive.testzip() is not None:
                    raise RuntimeError("Template archive validation failed")
            target = ROOT / ".tools/macos.zip"
            target.write_bytes(unpacked)
            print(f"Saved official macOS 4.5.1 template: {target}")
            return
        offset += 46 + name_len + extra_len + comment_len
    raise RuntimeError("macOS template missing from official archive")


if __name__ == "__main__":
    main()
