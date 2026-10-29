class_name EconomyService
extends RefCounted

var data: Dictionary = {}

func new_game() -> void:
	data = {"schema_version": 1, "initialized": true,
		"wallet": {"coins": 50000, "ammo": 10000}, "inventory": [],
		"selected_net_id": "net_qingxi",
		"settings": {"sound": true, "volume": 0.7, "reduce_flash": false, "quality": "high"},
		"statistics": {"captured": 0, "sold": 0, "bonus": 0}, "session_snapshot": {}}

func spend(net: NetDefinition) -> bool:
	if int(data.wallet.coins) < net.coin_cost or int(data.wallet.ammo) < net.ammo_cost:
		return false
	data.wallet.coins = int(data.wallet.coins) - net.coin_cost
	data.wallet.ammo = int(data.wallet.ammo) - net.ammo_cost
	return true

func capture(definition: FishDefinition, instance_id: int) -> void:
	for entry: Dictionary in data.inventory:
		if entry.fish_id == definition.id and int(entry.unit_value) == definition.sale_value:
			entry.quantity = int(entry.quantity) + 1
			data.statistics.captured = int(data.statistics.captured) + 1
			return
	data.inventory.append({"batch_id": instance_id, "fish_id": definition.id,
		"quantity": 1, "unit_value": definition.sale_value})
	data.statistics.captured = int(data.statistics.captured) + 1

func sell(fish_id: String = "") -> int:
	var income: int = 0
	var remaining: Array = []
	for entry: Dictionary in data.inventory:
		if fish_id.is_empty() or entry.fish_id == fish_id:
			income += int(entry.quantity) * int(entry.unit_value)
			data.statistics.sold = int(data.statistics.sold) + int(entry.quantity)
		else:
			remaining.append(entry)
	data.inventory = remaining
	data.wallet.coins = int(data.wallet.coins) + income
	return income

func supply() -> void:
	data.wallet.coins = int(data.wallet.coins) + 5000
	data.wallet.ammo = int(data.wallet.ammo) + 1000

func bonus() -> void:
	data.wallet.coins = int(data.wallet.coins) + 3600
	data.statistics.bonus = int(data.statistics.bonus) + 1

func inventory_count() -> int:
	var count: int = 0
	for entry: Dictionary in data.inventory:
		count += int(entry.quantity)
	return count
