from PIL import Image, ImageDraw
import sys, json, os

img_path = sys.argv[1]
base_name = os.path.basename(img_path).replace(".jpg", "").replace(".png", "")
out_img_path = f"/opt/wtc/new-bot/variants/{base_name}.png"
out_json_path = f"/opt/wtc/new-bot/variants/{base_name}.json"

img = Image.open(img_path).convert("RGBA")
width, height = img.size
pixels = img.load()

grid = []
for y in range(height):
    row = []
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # Relaxed chroma key threshold
        row.append(g > 80 and g > r * 1.2 and g > b * 1.2)
    grid.append(row)

visited = set()
largest_component = []
max_size = 0

for y in range(height):
    for x in range(width):
        if grid[y][x] and (x, y) not in visited:
            comp = []
            queue = [(x, y)]
            visited.add((x, y))
            head = 0
            while head < len(queue):
                cx, cy = queue[head]
                head += 1
                comp.append((cx, cy))
                if cx > 0 and grid[cy][cx-1] and (cx-1, cy) not in visited:
                    visited.add((cx-1, cy))
                    queue.append((cx-1, cy))
                if cx < width-1 and grid[cy][cx+1] and (cx+1, cy) not in visited:
                    visited.add((cx+1, cy))
                    queue.append((cx+1, cy))
                if cy > 0 and grid[cy-1][cx] and (cx, cy-1) not in visited:
                    visited.add((cx, cy-1))
                    queue.append((cx, cy-1))
                if cy < height-1 and grid[cy+1][cx] and (cx, cy+1) not in visited:
                    visited.add((cx, cy+1))
                    queue.append((cx, cy+1))
            if len(comp) > max_size:
                max_size = len(comp)
                largest_component = comp

if not largest_component:
    print(f"No green screen found in {img_path}.")
    sys.exit(1)

min_x = min(p[0] for p in largest_component)
max_x = max(p[0] for p in largest_component)
min_y = min(p[1] for p in largest_component)
max_y = max(p[1] for p in largest_component)

mask = Image.new("L", img.size, 255)
draw = ImageDraw.Draw(mask)
draw.ellipse([min_x - 5, min_y - 5, max_x + 5, max_y + 5], fill=0)

img.putalpha(mask)
img.save(out_img_path)

coords = {
    "x": min_x,
    "y": min_y,
    "w": max_x - min_x,
    "h": max_y - min_y,
    "center_x": (min_x + max_x) // 2,
    "center_y": (min_y + max_y) // 2
}
with open(out_json_path, 'w') as f:
    json.dump(coords, f)

print(f"Successfully v3 auto-processed {base_name}! BBox: {coords['w']}x{coords['h']}")
