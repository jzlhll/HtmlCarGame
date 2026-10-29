shader_type canvas_item;
uniform float age = 0.0;
uniform vec4 rope_tint : source_color = vec4(0.7, 0.9, 0.86, 1.0);
varying vec4 vertex_color;
void vertex() {
	vertex_color = COLOR;
}
void fragment() {
	vec2 p = UV - vec2(0.5);
	float r = length(p);
	float a = atan(p.y, p.x);
	// 绳网在水中有轻微不均匀张力，保持绳结纹理与网孔真实可见。
	float ripple = sin(a * 5.0 + age * 8.0) * sin(r * 10.0 - age * 6.0) * 0.008;
	vec2 uv = vec2(0.5) + p * (1.0 + ripple);
	vec4 rope = texture(TEXTURE, uv);
	rope.rgb *= mix(vec3(0.78, 0.92, 0.91), rope_tint.rgb, 0.24);
	COLOR = rope * vertex_color;
}
