class_name FishDefinition
extends Resource

@export var id: String = ""
@export var display_name: String = ""
@export_enum("inventory", "bonus_direct") var reward_mode: String = "inventory"
@export var p_base: float = 0.08
@export var sale_value: int = 600
@export var length: float = 280.0
@export var collision_ratio: Vector2 = Vector2(0.36, 0.15)
@export var speed_range: Vector2 = Vector2(45, 60)
@export var texture: Texture2D
@export var group_range: Vector2i = Vector2i.ONE
@export_enum("school", "medium", "large", "shark", "bonus") var spawn_kind: String = "medium"
