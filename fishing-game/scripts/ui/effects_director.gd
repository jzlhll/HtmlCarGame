class_name EffectsDirector
extends Node2D

signal coin_arrived

var nets: Array[Dictionary] = []
var captures: Array[Dictionary] = []
var coins: Array[Dictionary] = []
var texts: Array[Dictionary] = []
var rain: Array[Dictionary] = []
var clock: float = 0.0
var reduce_flash: bool = false
var low_quality: bool = false
var sound_enabled: bool = true
var rng: RandomNumberGenerator = RandomNumberGenerator.new()
var players: Array[AudioStreamPlayer] = []
var sounds: Dictionary[String, AudioStreamWAV] = {}
var font: Font = preload("res://resources/ui_font.tres")
var basket_target: Vector2 = Vector2(1430, 812)
var wallet_target: Vector2 = Vector2(1248, 50)
var net_texture: Texture2D = preload("res://assets/art/cast_net.png")
var net_pool: Array[Sprite2D] = []

func _ready() -> void:
	rng.randomize()
	for index: int in range(12):
		var sprite: Sprite2D = Sprite2D.new()
		sprite.texture = net_texture
		var material: ShaderMaterial = ShaderMaterial.new()
		material.shader = preload("res://shaders/net.gdshader")
		sprite.material = material
		sprite.hide()
		add_child(sprite)
		net_pool.append(sprite)
	for name: String in ["fire", "net", "capture", "coin", "ui", "supply", "warning"]:
		sounds[name] = load("res://assets/audio/%s.wav" % name) as AudioStreamWAV
	for index: int in range(8):
		var player: AudioStreamPlayer = AudioStreamPlayer.new()
		player.bus = "SFX"
		add_child(player)
		players.append(player)

func sound(name: String, pitch: float = 1.0) -> void:
	if not sound_enabled:
		return
	for player: AudioStreamPlayer in players:
		if not player.playing:
			player.stream = sounds[name]
			player.pitch_scale = pitch
			player.play()
			return

func open_net(center: Vector2, net: Dictionary) -> void:
	if nets.size() >= 12:
		var expired: Dictionary = nets.pop_front()
		(expired.sprite as Sprite2D).hide()
	var sprite: Sprite2D
	for candidate: Sprite2D in net_pool:
		if not candidate.visible:
			sprite = candidate
			break
	if sprite == null:
		return
	sprite.position = center
	sprite.texture = load(str(net.get("texture_path", "res://assets/art/cast_net.png"))) as Texture2D
	sprite.rotation = rng.randf_range(-0.4, 0.4)
	sprite.show()
	(sprite.material as ShaderMaterial).set_shader_parameter("rope_tint", Color.html(net.color))
	nets.append({"sprite": sprite, "radius": float(net.radius), "age": 0.0})
	sound("net")

func capture_fish(fish: FishActor, net: Dictionary, bonus: bool = false) -> void:
	var start: Vector2 = fish.position
	captures.append({"fish": fish, "start": start, "rotation": fish.rotation, "age": 0.0, "bonus": bonus,
		"net_texture": load(str(net.get("texture_path", "res://assets/art/cast_net.png"))) as Texture2D})
	if bonus:
		rain.append({"position": start, "age": 0.0, "batch": 0})
		floating("星翼宝鲂  +3,600", start + Vector2(0, -80), Color("ffdc85"), 4.8)
	else:
		floating("%s · 收入鱼篓" % fish.definition.display_name, start + Vector2(0, -35), Color("b5f0db"))
	sound("capture")

func sold(amount: int) -> void:
	if amount <= 0:
		return
	floating("+%s 金币" % amount, Vector2(1180, 220), Color("ffe0a0"))
	_emit_coins(Vector2(1220, 360), 14 if not low_quality else 6)
	sound("coin")

func floating(message: String, at: Vector2, color: Color = Color.WHITE, duration: float = 1.6) -> void:
	if texts.size() > 20:
		texts.pop_front()
	texts.append({"text": message, "position": at, "color": color, "age": 0.0, "duration": duration})

func _emit_coins(at: Vector2, count: int) -> void:
	var limit: int = 24 if low_quality else 64
	for index: int in range(count):
		if coins.size() >= limit:
			break
		coins.append({"start": at, "bend": at + Vector2(rng.randf_range(-160, 180), rng.randf_range(-180, -65)),
			"age": -index * 0.018, "duration": rng.randf_range(0.9, 1.25), "phase": rng.randf() * TAU})

func simulate(delta: float) -> void:
	clock += delta
	for net: Dictionary in nets:
		net.age = float(net.age) + delta
		var age: float = float(net.age)
		var sprite: Sprite2D = net.sprite
		var expansion: float = 0.15 + 0.85 * (1 - pow(1 - clampf(age / 0.22, 0, 1), 3))
		var cinch: float = smoothstep(0.50, 1.05, age)
		var diameter: float = float(net.radius) * 2.0 / 0.91
		sprite.scale = Vector2(diameter, diameter * lerpf(0.90, 0.65, cinch)) / sprite.texture.get_size() * expansion * lerpf(1.0, 0.62, cinch)
		sprite.modulate.a = (1 - smoothstep(0.68, 1.05, age)) * 0.85
		(sprite.material as ShaderMaterial).set_shader_parameter("age", age)
		if age >= 1.05:
			sprite.hide()
	nets = nets.filter(func(net: Dictionary) -> bool: return float(net.age) < 1.05)
	for capture: Dictionary in captures:
		capture.age = float(capture.age) + delta
		var fish: FishActor = capture.fish
		if not is_instance_valid(fish):
			continue
		var duration: float = 4.8 if capture.bonus else 0.95
		var t: float = clampf(float(capture.age) / duration, 0, 1)
		if capture.bonus:
			fish.position = capture.start + Vector2(0, sin(t * TAU * 2) * 7)
			fish.modulate.a = 1.0 - smoothstep(0.8, 1.0, t)
		else:
			var travel: float = smoothstep(0.22, 1.0, t)
			fish.position = (capture.start as Vector2).lerp(basket_target, travel) + Vector2(0, -sin(travel * PI) * 95)
			fish.scale = Vector2(float(fish.direction), 1) * (1.0 - travel * 0.95)
			fish.rotation = float(capture.rotation) + t * 0.7
			fish.modulate.a = 1 - smoothstep(0.78, 1.0, t)
		fish.fish_material.set_shader_parameter("swim_time", fish.age + float(capture.age) * 2)
		if t >= 1:
			fish.state = FishActor.State.REMOVED
			fish.queue_free()
	captures = captures.filter(func(capture: Dictionary) -> bool: return float(capture.age) < (4.8 if capture.bonus else 0.95))
	for reward: Dictionary in rain:
		reward.age = float(reward.age) + delta
		while int(reward.batch) < 12 and float(reward.age) >= int(reward.batch) * 0.4:
			_emit_coins(reward.position, 3 if low_quality else 8)
			sound("coin", 0.9 + int(reward.batch) * 0.035)
			reward.batch = int(reward.batch) + 1
	rain = rain.filter(func(reward: Dictionary) -> bool: return float(reward.age) < 4.8)
	for coin: Dictionary in coins:
		coin.age = float(coin.age) + delta
		if float(coin.age) >= float(coin.duration):
			coin_arrived.emit()
	coins = coins.filter(func(coin: Dictionary) -> bool: return float(coin.age) < float(coin.duration))
	for message: Dictionary in texts:
		message.age = float(message.age) + delta
	texts = texts.filter(func(message: Dictionary) -> bool: return float(message.age) < float(message.duration))
	queue_redraw()

func _draw() -> void:
	for capture: Dictionary in captures:
		if capture.bonus or not is_instance_valid(capture.fish):
			continue
		var fish: FishActor = capture.fish
		var travel: float = smoothstep(0.22, 1, float(capture.age) / 0.95)
		var size: Vector2 = Vector2(fish.definition.length * 1.3, fish.definition.length * 0.86) * (1 - travel * 0.95)
		draw_set_transform(fish.position, fish.rotation)
		draw_texture_rect(capture.net_texture, Rect2(-size * 0.5, size), false, Color(0.75, 0.91, 0.89, 0.64 * fish.modulate.a))
		draw_set_transform(Vector2.ZERO)
	for coin: Dictionary in coins:
		if float(coin.age) < 0:
			continue
		var t: float = clampf(float(coin.age) / float(coin.duration), 0, 1)
		var p: Vector2 = (coin.start as Vector2).bezier_interpolate(coin.bend, (coin.bend as Vector2).lerp(wallet_target, 0.65), wallet_target, t)
		var width: float = 0.4 + absf(cos(t * TAU * 2 + float(coin.phase))) * 0.6
		draw_set_transform(p, 0, Vector2(width, 1))
		draw_circle(Vector2.ZERO, 11, Color("b77b2a"))
		draw_circle(Vector2(0, -1), 9, Color("f6cb6e"))
		draw_arc(Vector2(0, -1), 6.5, 0, TAU, 20, Color("ffe8a9"), 1, true)
		draw_line(Vector2(0, -5), Vector2(0, 4), Color("a97028"), 2)
		draw_set_transform(Vector2.ZERO)
	for message: Dictionary in texts:
		var t: float = float(message.age) / float(message.duration)
		var color: Color = message.color
		color.a = 1 - smoothstep(0.7, 1.0, t)
		var at: Vector2 = message.position + Vector2(0, -t * 42)
		var width: float = font.get_string_size(message.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 22).x
		at.x -= width * 0.5
		draw_string_outline(font, at, message.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, 6, Color(0.02, 0.10, 0.13, color.a))
		draw_string(font, at, message.text, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, color)
