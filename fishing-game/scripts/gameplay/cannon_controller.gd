class_name CannonController
extends Node2D

var angle: float = 0.0
var cooldown: float = 0.0
var recoil: float = 0.0
var flash: float = 0.0
var barrel: Sprite2D
var reduce_flash: bool = false

func _ready() -> void:
	position = Vector2(800, 790)
	barrel = Sprite2D.new()
	barrel.texture = preload("res://assets/art/cannon.png")
	barrel.scale = Vector2.ONE * (188.0 / barrel.texture.get_height())
	add_child(barrel)
	_update_barrel()

func simulate(delta: float, axis: float) -> void:
	angle = clampf(angle + axis * deg_to_rad(100.0) * delta, -deg_to_rad(75.0), deg_to_rad(75.0))
	cooldown = maxf(0.0, cooldown - delta)
	recoil = move_toward(recoil, 0.0, delta * 70.0)
	flash = maxf(0.0, flash - delta)
	_update_barrel()
	queue_redraw()

func aim(target: Vector2) -> void:
	angle = clampf((target - position).angle() + PI * 0.5, -deg_to_rad(75.0), deg_to_rad(75.0))
	# 炮口偏离旋转轴后再次求方向，使实际弹道指向触点。
	angle = clampf((target - muzzle()).angle() + PI * 0.5, -deg_to_rad(75.0), deg_to_rad(75.0))
	_update_barrel()

func direction_vector() -> Vector2:
	return Vector2.UP.rotated(angle)

func muzzle() -> Vector2:
	return position + direction_vector() * 163.0

func fired() -> void:
	cooldown = 0.25
	recoil = 12.0
	flash = 0.08

func _update_barrel() -> void:
	if barrel == null:
		return
	barrel.rotation = angle
	barrel.position = Vector2(0, -75 + recoil).rotated(angle)

func _draw() -> void:
	draw_circle(Vector2(0, 14), 81, Color(0.015, 0.06, 0.08, 0.6))
	draw_circle(Vector2.ZERO, 72, Color("163e47"))
	draw_arc(Vector2.ZERO, 68, 0, TAU, 80, Color("c8a867"), 5, true)
	draw_arc(Vector2.ZERO, 55, 0, TAU, 80, Color("48767a"), 2, true)
	for index: int in range(12):
		var p: Vector2 = Vector2.from_angle(index * TAU / 12) * 61
		draw_circle(p, 3, Color("ead5a0"))
	if flash > 0 and not reduce_flash:
		var p: Vector2 = direction_vector() * 163
		draw_circle(p, 18 * flash / 0.08, Color(1, 0.88, 0.5, 0.8))
