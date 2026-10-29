class_name FishActor
extends Node2D

enum State { ENTERING, SWIMMING, CAPTURED, REWARDING, ESCAPING, REMOVED }
var definition: FishDefinition
var instance_id: int = 0
var school_id: int = 0
var state: State = State.ENTERING
var origin: Vector2
var direction: int = 1
var speed: float = 60.0
var age: float = 0.0
var phase: float = 0.0
var amplitude: float = 35.0
var life: float = 40.0
var hit_time: float = 0.0
var body: Polygon2D
var shadow: Polygon2D
var fish_material: ShaderMaterial

func setup(config: FishDefinition, snapshot: Dictionary) -> void:
	definition = config
	instance_id = int(snapshot.id)
	school_id = int(snapshot.school)
	origin = Vector2(snapshot.origin[0], snapshot.origin[1])
	position = Vector2(snapshot.position[0], snapshot.position[1])
	direction = int(snapshot.direction)
	speed = float(snapshot.speed)
	age = float(snapshot.age)
	phase = float(snapshot.phase)
	amplitude = float(snapshot.amplitude)
	life = float(snapshot.life)
	_build_body()
	_update_pose()

func _build_body() -> void:
	var source: Texture2D = definition.texture
	var region: Rect2 = Rect2(Vector2.ZERO, source.get_size())
	var texture: Texture2D = source
	if source is AtlasTexture:
		region = (source as AtlasTexture).region
		texture = (source as AtlasTexture).atlas
	var width: float = definition.length
	# 图集保留透明边距，宽鳍鱼保持原始比例。
	var height: float = width * region.size.y / region.size.x
	if definition.id == "starwing_bonus":
		height = width * 1.26
	var vertices: PackedVector2Array = []
	var uvs: PackedVector2Array = []
	var cells: Array[PackedInt32Array] = []
	for row: int in range(7):
		for col: int in range(25):
			var ratio: Vector2 = Vector2(col / 24.0, row / 6.0)
			vertices.append((ratio - Vector2(0.5, 0.5)) * Vector2(width, height))
			uvs.append(region.position + ratio * region.size)
	for row: int in range(6):
		for col: int in range(24):
			var index: int = row * 25 + col
			cells.append(PackedInt32Array([index, index + 1, index + 26, index + 25]))
	fish_material = ShaderMaterial.new()
	fish_material.shader = preload("res://shaders/fish.gdshader")
	fish_material.set_shader_parameter("fish_width", width)
	shadow = Polygon2D.new()
	shadow.polygon = vertices
	shadow.uv = uvs
	shadow.polygons = cells
	shadow.texture = texture
	shadow.position = Vector2(12, 30)
	shadow.modulate = Color(0.015, 0.10, 0.13, 0.28)
	shadow.scale = Vector2(0.94, 0.80)
	add_child(shadow)
	body = Polygon2D.new()
	body.polygon = vertices
	body.uv = uvs
	body.polygons = cells
	body.texture = texture
	body.material = fish_material
	add_child(body)

func simulate(delta: float, reduce_flash: bool) -> void:
	if state in [State.CAPTURED, State.REWARDING, State.REMOVED]:
		return
	age += delta
	life = maxf(0.0, life - delta)
	hit_time = maxf(0.0, hit_time - delta)
	var slow: float = 0.78 if hit_time > 0 else 1.0
	position.x += direction * speed * slow * delta
	position.y = origin.y + sin(age * 0.47 + phase) * amplitude
	_update_pose()
	fish_material.set_shader_parameter("swim_time", age + phase)
	fish_material.set_shader_parameter("hit", hit_time / 0.18)
	fish_material.set_shader_parameter("reduce_flash", reduce_flash)
	if definition.id == "pufferfish":
		body.scale = Vector2.ONE * (1 + hit_time / 0.18 * 0.10)
	var half: float = definition.length * 0.5
	if position.x > half + 40 and position.x < 1560 - half and state == State.ENTERING:
		state = State.SWIMMING
	if life <= 0 or (direction == 1 and position.x > 1690 + half) or (direction == -1 and position.x < -90 - half):
		state = State.REMOVED
	elif (direction == 1 and position.x > 1560 - half) or (direction == -1 and position.x < 40 + half):
		if state == State.SWIMMING:
			state = State.ESCAPING

func _update_pose() -> void:
	scale.x = float(direction)
	rotation = atan2(cos(age * 0.47 + phase) * amplitude * 0.47, speed) * direction * 0.28

func can_capture() -> bool:
	return state == State.SWIMMING

func hit() -> void:
	hit_time = 0.18

func collision_polygon() -> PackedVector2Array:
	var points: PackedVector2Array = []
	var radii: Vector2 = definition.collision_ratio * definition.length
	for index: int in range(24):
		var angle: float = index * TAU / 24.0
		points.append(to_global(Vector2(cos(angle), sin(angle)) * radii))
	return points

func snapshot() -> Dictionary:
	return {"id": instance_id, "definition": definition.id, "school": school_id,
		"position": [position.x, position.y], "origin": [origin.x, origin.y],
		"direction": direction, "speed": speed, "age": age, "phase": phase,
		"amplitude": amplitude, "life": life}
