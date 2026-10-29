class_name InputRouter
extends RefCounted

var left: bool = false
var right: bool = false
var shift_keys: Dictionary[int, bool] = {}
var modifier_keys: Dictionary[int, bool] = {}
var fire: bool:
	get:
		return not shift_keys.is_empty() or not modifier_keys.is_empty()
var primary_touch: int = -1
var active_touches: Array[int] = []
var mobile: bool = OS.has_feature("android") or OS.has_feature("ios")

func clear() -> void:
	left = false
	right = false
	shift_keys.clear()
	modifier_keys.clear()

func track(event: InputEvent) -> void:
	if event is InputEventKey and not event.pressed:
		match event.keycode:
			KEY_LEFT: left = false
			KEY_RIGHT: right = false
			KEY_SHIFT:
				shift_keys.erase(event.location)
				modifier_keys.clear()
		modifier_keys.erase(event.keycode)
	if event is InputEventScreenTouch:
		if event.pressed:
			if active_touches.is_empty():
				primary_touch = event.index
			active_touches.append(event.index)
		else:
			active_touches.erase(event.index)
			if event.index == primary_touch:
				primary_touch = -1

func accept_key(event: InputEventKey) -> void:
	if mobile or event.echo or not event.pressed:
		return
	match event.keycode:
		KEY_LEFT: left = true
		KEY_RIGHT: right = true
		KEY_SHIFT: shift_keys[event.location] = true
	if event.keycode != KEY_SHIFT and event.shift_pressed:
		modifier_keys[event.keycode] = true

func turn_axis() -> float:
	return float(int(right) - int(left))
