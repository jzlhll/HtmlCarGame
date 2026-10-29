class_name GameCatalog
extends RefCounted

const NET_IDS: Array[String] = ["net_qingxi", "net_yinsuo", "net_liuying", "net_yuelan", "net_leipo", "net_longxiao"]
const FISH_IDS: Array[String] = ["silver_sardine", "golden_anchovy", "coral_clownfish", "blue_tang", "butterflyfish", "red_bream", "pufferfish", "lionfish", "golden_grouper", "manta_ray", "great_shark", "starwing_bonus"]
var nets: Array[NetDefinition] = []
var fish: Dictionary[String, FishDefinition] = {}

func _init() -> void:
	for id: String in NET_IDS:
		nets.append(load("res://resources/nets/%s.tres" % id) as NetDefinition)
	for id: String in FISH_IDS:
		fish[id] = load("res://resources/fish/%s.tres" % id) as FishDefinition

func net_by_id(id: String) -> NetDefinition:
	for net: NetDefinition in nets:
		if net.id == id:
			return net
	return nets[0]
