class_name SeabedView
extends Node2D

var clock: float = 0.0
var low_quality: bool = false
var water_material: ShaderMaterial

func _ready() -> void:
	var background: Sprite2D = Sprite2D.new()
	background.texture = preload("res://assets/art/seabed.png")
	background.centered = false
	background.scale = Vector2(1600, 900) / background.texture.get_size()
	background.modulate = Color(0.72, 0.85, 0.87, 1)
	add_child(background)
	var water: ColorRect = ColorRect.new()
	water.size = Vector2(1600, 900)
	water.mouse_filter = Control.MOUSE_FILTER_IGNORE
	water_material = ShaderMaterial.new()
	water_material.shader = preload("res://shaders/water.gdshader")
	water.material = water_material
	add_child(water)

func simulate(delta: float, reduced_flash: bool) -> void:
	clock += delta
	water_material.set_shader_parameter("water_time", clock)
	water_material.set_shader_parameter("strength", 0.015 if reduced_flash or low_quality else 0.045)
	queue_redraw()

func _draw() -> void:
	var count: int = 12 if low_quality else 42
	for index: int in range(count):
		var phase: float = index * 12.718
		var p: Vector2 = Vector2(fposmod(index * 163.72 + sin(clock * 0.4 + phase) * 17, 1600), 760 - fposmod(clock * (9 + index % 8) + index * 49.3, 680))
		var radius: float = 1.0 + (index % 4) * 0.6
		draw_arc(p, radius, 0.2, 5.0, 12, Color(0.6, 0.9, 0.88, 0.23), 1, true)
	for side: int in range(2):
		for index: int in range(12 if not low_quality else 5):
			var x: float = 20 + index * 16 if side == 0 else 1580 - index * 16
			var base: Vector2 = Vector2(x, 765)
			var height: float = 48 + fposmod(index * 21.7, 70)
			var sway: float = sin(clock * 0.75 + index * 0.8) * 15
			var points: PackedVector2Array = []
			for segment: int in range(9):
				var t: float = segment / 8.0
				points.append(base + Vector2(sway * t * t + sin(t * PI) * 7, -height * t))
			draw_polyline(points, Color(0.07, 0.27 + index * 0.006, 0.27, 0.85), 5, true)
