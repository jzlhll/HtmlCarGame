shader_type canvas_item;
uniform float swim_time = 0.0;
uniform float fish_width = 280.0;
uniform float hit = 0.0;
uniform bool reduce_flash = false;
varying vec4 vertex_color;
void vertex() {
	vertex_color = COLOR;
	float tail = clamp(0.55 - VERTEX.x / fish_width, 0.0, 1.0);
	VERTEX.y += sin(swim_time * 6.0 + tail * 4.5) * tail * tail * fish_width * 0.045;
	float fin = smoothstep(0.10, 0.28, abs(VERTEX.y) / fish_width);
	VERTEX.y += sin(swim_time * 4.1 + VERTEX.x * 0.03) * fin * fish_width * 0.009;
}
void fragment() {
	vec4 c = texture(TEXTURE, UV) * vertex_color;
	c.rgb = mix(c.rgb, vec3(0.65, 1.0, 0.95), hit * (reduce_flash ? 0.18 : 0.55));
	COLOR = c;
}
