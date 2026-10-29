class_name NetDefinition
extends Resource

@export var id: String = ""
@export var display_name: String = ""
@export var icon: Texture2D
@export var tier: int = 1
@export var mesh_texture: Texture2D
@export var coin_cost: int = 1
@export var ammo_cost: int = 1
@export var radius: float = 64.0
@export var probability_factor: float = 1.0
@export var effect_theme: Color = Color.CYAN

func freeze() -> Dictionary:
	return {"id": id, "coin_cost": coin_cost, "ammo_cost": ammo_cost,
		"radius": radius, "probability_factor": probability_factor, "color": effect_theme.to_html(),
		"texture_path": mesh_texture.resource_path}
