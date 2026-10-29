"""生成可编辑的 Godot Resource、原创网纹图标与合成短音效。"""
from pathlib import Path
import math
import random
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
NETS = [
    ("qingxi", "破网", 1, 64, 1.0, "aa8e6a"),
    ("yinsuo", "粗绳网", 3, 80, 1.4, "c4ae84"),
    ("liuying", "密织网", 5, 100, 1.8, "c9d8c4"),
    ("yuelan", "银丝网", 8, 120, 2.2, "cfdeeb"),
    ("leipo", "鎏金网", 12, 142, 2.7, "e7c57d"),
    ("longxiao", "龙绡网", 18, 160, 3.2, "ddbbeb"),
]
NET_TEXTURES = ["cast_net_torn", "cast_net_hemp", "cast_net", "cast_net_silver", "cast_net_gold", "cast_net_dragon"]
FISH = [
    ("silver_sardine", "银鳞沙丁", 48, .60, 12, "school", 8, 14, 0),
    ("golden_anchovy", "金线小鳀", 54, .50, 18, "school", 6, 10, 1),
    ("coral_clownfish", "珊瑚小丑", 64, .40, 28, "school", 3, 5, 2),
    ("blue_tang", "蓝绸", 84, .32, 45, "school", 3, 6, 3),
    ("butterflyfish", "月纹蝶", 92, .28, 60, "medium", 1, 2, 4),
    ("red_bream", "赤霞鲷", 116, .22, 90, "medium", 1, 1, 5),
    ("pufferfish", "圆斑河鲀", 120, .18, 120, "medium", 1, 1, 6),
    ("lionfish", "绯羽狮", 146, .15, 180, "medium", 1, 1, 7),
    ("golden_grouper", "金纹石斑", 280, .08, 600, "large", 1, 1, -1),
    ("manta_ray", "青翼鳐", 320, .07, 900, "large", 1, 1, 8),
    ("great_shark", "深海巨鲨", 470, .00002, 30000, "shark", 1, 1, -1),
    ("starwing_bonus", "星翼宝鲂", 190, 1, 3600, "bonus", 1, 1, -1),
]
# 原图逐鱼检查后的像素边界，避免生成图的鳍条跨过等分线。
ATLAS_REGIONS = [
    (0, 104, 426, 220), (430, 114, 415, 208), (851, 80, 403, 253),
    (0, 444, 427, 300), (435, 436, 395, 312), (830, 448, 424, 300),
    (0, 840, 398, 315), (409, 768, 430, 432), (842, 768, 412, 432),
]


def main():
    for tier, (short, name, cost, radius, factor, color) in enumerate(NETS, 1):
        points = " ".join(f"{32 + 22 * math.cos(i * math.tau / 6):.2f},{32 + 22 * math.sin(i * math.tau / 6):.2f}" for i in range(6))
        spokes = "".join(f'<path d="M32 32L{32 + 22 * math.cos(i * math.tau / 6):.2f} {32 + 22 * math.sin(i * math.tau / 6):.2f}"/>' for i in range(6))
        (ROOT / f"assets/art/net_{short}.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><g fill="none" stroke="#{color}" stroke-width="1.5"><polygon points="{points}"/><circle cx="32" cy="32" r="12"/>{spokes}</g><circle cx="32" cy="32" r="4" fill="#{color}"/></svg>')
        rgb = [int(color[i:i+2], 16) / 255 for i in (0, 2, 4)]
        (ROOT / f"resources/nets/net_{short}.tres").write_text(f'''[gd_resource type="Resource" script_class="NetDefinition" load_steps=3 format=3]
[ext_resource type="Script" path="res://scripts/gameplay/net_definition.gd" id="1"]
[ext_resource type="Texture2D" path="res://assets/art/{NET_TEXTURES[tier - 1]}.png" id="2"]
[resource]
script = ExtResource("1")
id = "net_{short}"
display_name = "{name}"
icon = ExtResource("2")
tier = {tier}
mesh_texture = ExtResource("2")
coin_cost = {cost}
radius = {float(radius)}
probability_factor = {float(factor)}
effect_theme = Color({rgb[0]}, {rgb[1]}, {rgb[2]}, 1)
''')
    atlas = ROOT / "assets/art/fish_atlas.png"
    w, h = struct.unpack(">II", atlas.read_bytes()[16:24])
    for fid, name, length, probability, value, kind, lo, hi, cell in FISH:
        if cell >= 0:
            x, y, rw, rh = ATLAS_REGIONS[cell]
            texture = f'''[ext_resource type="Texture2D" path="res://assets/art/fish_atlas.png" id="2"]
[sub_resource type="AtlasTexture" id="FishTexture"]
atlas = ExtResource("2")
region = Rect2({x * w / 1254}, {y * h / 1254}, {rw * w / 1254}, {rh * h / 1254})
filter_clip = true
'''
            tex_ref = 'SubResource("FishTexture")'
            steps = 4
        else:
            texture = f'[ext_resource type="Texture2D" path="res://assets/art/{fid}.png" id="2"]\n'
            tex_ref = 'ExtResource("2")'
            steps = 3
        duration = {"school": (85, 120), "medium": (50, 80), "large": (43, 57), "shark": (75, 85), "bonus": (170, 185)}[kind]
        ratio = (.32, .21) if fid in ("pufferfish", "butterflyfish", "blue_tang") else (.36, .14)
        if fid in ("manta_ray", "starwing_bonus"):
            ratio = (.34, .32)
        if fid == "starwing_bonus":
            ratio = (.4, .57)
        (ROOT / f"resources/fish/{fid}.tres").write_text(f'''[gd_resource type="Resource" script_class="FishDefinition" load_steps={steps} format=3]
[ext_resource type="Script" path="res://scripts/gameplay/fish_definition.gd" id="1"]
{texture}
[resource]
script = ExtResource("1")
id = "{fid}"
display_name = "{name}"
reward_mode = "{'bonus_direct' if kind == 'bonus' else 'inventory'}"
p_base = {float(probability)}
sale_value = {value}
length = {float(length)}
collision_ratio = Vector2{ratio}
speed_range = Vector2{duration}
texture = {tex_ref}
group_range = Vector2i({lo}, {hi})
spawn_kind = "{kind}"
''')
    random.seed(712)
    for name, frequency, seconds in [("fire", 180, .11), ("net", 520, .22), ("capture", 880, .36), ("coin", 1400, .20), ("ui", 650, .09), ("supply", 740, .32), ("warning", 1100, .30)]:
        samples = bytearray()
        for i in range(int(22050 * seconds)):
            t = i / 22050
            env = math.sin(math.pi * t / seconds) ** .8 * math.exp(-t * 6)
            pitch = frequency * (1 + t * (3 if name in ("capture", "supply") else -1.2))
            tone = math.sin(math.tau * pitch * t) + .25 * math.sin(math.tau * pitch * 2.01 * t)
            if name in ("fire", "net"):
                tone = .4 * tone + .5 * random.uniform(-1, 1)
            samples.extend(struct.pack("<h", int(10000 * env * tone)))
        with wave.open(str(ROOT / f"assets/audio/{name}.wav"), "wb") as stream:
            stream.setparams((1, 2, 22050, 0, "NONE", "not compressed"))
            stream.writeframes(samples)


if __name__ == "__main__":
    main()
