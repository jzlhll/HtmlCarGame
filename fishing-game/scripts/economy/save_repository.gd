class_name SaveRepository
extends RefCounted

const PATH: String = "user://tide_save.json"
const BACKUP: String = "user://tide_save.backup.json"
const TEMP: String = "user://tide_save.tmp"
var last_error: String = ""
var recovery_message: String = ""

func read_save() -> Dictionary:
	last_error = ""
	if not FileAccess.file_exists(PATH) and not FileAccess.file_exists(BACKUP):
		return {}
	var primary: Dictionary = _read(PATH)
	if validate(primary):
		return primary
	if int(primary.get("schema_version", 0)) > 1:
		last_error = "存档来自更新版本，请使用匹配版本打开。"
		return {}
	var backup: Dictionary = _read(BACKUP)
	if validate(backup):
		recovery_message = "已从备份恢复，原存档已保留。"
		if FileAccess.file_exists(PATH):
			DirAccess.copy_absolute(PATH, PATH + ".damaged_" + str(Time.get_unix_time_from_system()))
		return backup
	last_error = "存档或备份无法读取。原文件已保留，请重试或明确新建存档。"
	return {}

func write_save(data: Dictionary) -> bool:
	last_error = ""
	if not validate(data):
		last_error = "存档校验未通过，已暂停交易。"
		push_error("Save validation failed")
		return false
	var file: FileAccess = FileAccess.open(TEMP, FileAccess.WRITE)
	if file == null:
		return _fail("Cannot open save temporary file")
	file.store_string(JSON.stringify(data))
	file.flush()
	var write_error: Error = file.get_error()
	file.close()
	if write_error != OK or not validate(_read(TEMP)):
		return _fail("Cannot verify temporary save")
	if validate(_read(PATH)):
		if DirAccess.copy_absolute(PATH, BACKUP + ".tmp") != OK:
			return _fail("Cannot stage save backup")
		if DirAccess.rename_absolute(BACKUP + ".tmp", BACKUP) != OK:
			return _fail("Cannot replace save backup")
	if DirAccess.rename_absolute(TEMP, PATH) != OK:
		return _fail("Cannot replace primary save")
	return true

func preserve_before_reset() -> bool:
	for path: String in [PATH, BACKUP]:
		if FileAccess.file_exists(path):
			if DirAccess.rename_absolute(path, path + ".preserved_" + str(Time.get_unix_time_from_system())) != OK:
				return _fail("Cannot preserve damaged save")
	return true

func _fail(message: String) -> bool:
	push_error(message)
	last_error = "无法保存进度。请检查存储空间或权限，然后点击重试。"
	return false

func _read(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var file: FileAccess = FileAccess.open(path, FileAccess.READ)
	if file == null or file.get_length() > 8 * 1024 * 1024:
		return {}
	var parsed: Variant = JSON.parse_string(file.get_as_text())
	return parsed if parsed is Dictionary else {}

func _integer(value: Variant, lower: int = 0, upper: int = 1000000000000) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and float(value) == floor(float(value)) and value >= lower and value <= upper

func _number(value: Variant, lower: float, upper: float) -> bool:
	return (value is int or value is float) and is_finite(float(value)) and value >= lower and value <= upper

func _vector(value: Variant) -> bool:
	return value is Array and value.size() == 2 and _number(value[0], -5000, 5000) and _number(value[1], -5000, 5000)

func validate(data: Dictionary) -> bool:
	if data.get("schema_version") != 1 or data.get("initialized") != true:
		return false
	var wallet: Variant = data.get("wallet")
	if not wallet is Dictionary or not _integer(wallet.get("coins")) or not _integer(wallet.get("ammo")):
		return false
	if not data.get("selected_net_id", "") is String:
		return false
	var entries: Variant = data.get("inventory")
	if not entries is Array or entries.size() > 256:
		return false
	var ids: Dictionary = {}
	for entry: Variant in entries:
		if not entry is Dictionary or entry.get("fish_id", "") not in GameCatalog.FISH_IDS or entry.get("fish_id") == "starwing_bonus":
			return false
		if not _integer(entry.get("quantity"), 1) or not _integer(entry.get("unit_value")) or not _integer(entry.get("batch_id"), 1):
			return false
		if ids.has(str(entry.batch_id)):
			return false
		ids[str(entry.batch_id)] = true
	var settings: Variant = data.get("settings")
	if not settings is Dictionary or not settings.get("sound") is bool or not settings.get("reduce_flash") is bool:
		return false
	if not _number(settings.get("volume"), 0, 1) or settings.get("quality") not in ["low", "high"]:
		return false
	var statistics: Variant = data.get("statistics")
	if not statistics is Dictionary:
		return false
	for key: String in ["captured", "sold", "bonus"]:
		if not _integer(statistics.get(key)):
			return false
	var snap: Variant = data.get("session_snapshot")
	if not snap is Dictionary or not _integer(snap.get("next_id"), 1) or not _number(snap.get("clock"), 0, 1e12):
		return false
	if not str(snap.get("rng_state", "")).is_valid_int() or not _number(snap.get("cannon_angle"), -1.31, 1.31) or not _number(snap.get("cooldown"), 0, 0.25):
		return false
	var fishes: Variant = snap.get("fish")
	var shots: Variant = snap.get("shots")
	if not fishes is Array or fishes.size() > 60 or not shots is Array or shots.size() > 24:
		return false
	ids.clear()
	for fish: Variant in fishes:
		if not fish is Dictionary or fish.get("definition", "") not in GameCatalog.FISH_IDS or not _integer(fish.get("id"), 1):
			return false
		if ids.has(str(fish.id)) or int(fish.id) >= int(snap.next_id):
			return false
		ids[str(fish.id)] = true
		for key: String in ["position", "origin"]:
			if not _vector(fish.get(key)):
				return false
		for key: String in ["age", "phase", "amplitude", "speed", "life"]:
			if not _number(fish.get(key), 0, 1e9):
				return false
		if not _integer(fish.get("direction"), -1, 1) or int(fish.direction) == 0 or not _integer(fish.get("school")):
			return false
	for shot: Variant in shots:
		if not shot is Dictionary or not _integer(shot.get("id"), 1) or ids.has(str(shot.id)) or int(shot.id) >= int(snap.next_id):
			return false
		ids[str(shot.id)] = true
		if not _vector(shot.get("position")) or not _vector(shot.get("direction")) or not _number(shot.get("life"), 0, 3):
			return false
		var net: Variant = shot.get("net")
		if not net is Dictionary or net.get("id", "") not in GameCatalog.NET_IDS:
			return false
		if not _number(net.get("radius"), 1, 500) or not _number(net.get("probability_factor"), 0, 100):
			return false
		if not _integer(net.get("coin_cost")) or not _integer(net.get("ammo_cost"), 1) or not net.get("color") is String or not Color.html_is_valid(net.color):
			return false
		if net.has("texture_path") and str(net.texture_path) not in ["res://assets/art/cast_net.png", "res://assets/art/cast_net_torn.png", "res://assets/art/cast_net_hemp.png", "res://assets/art/cast_net_silver.png", "res://assets/art/cast_net_gold.png", "res://assets/art/cast_net_dragon.png"]:
			return false
	var director: Variant = snap.get("director")
	if not director is Dictionary or director.get("bonus_state") not in ["waiting", "warning", "active", "rewarding"]:
		return false
	for key: String in ["school", "medium", "large", "shark", "bonus", "warning", "reward"]:
		if not _number(director.get(key), 0, 10000):
			return false
	return true
