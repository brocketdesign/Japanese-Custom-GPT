import os
from PIL import Image

# Directory containing the images
directory = os.path.dirname(os.path.abspath(__file__))

# Supported image extensions
image_extensions = ('.jpg', '.jpeg', '.bmp', '.gif', '.tiff', '.webp')

for filename in os.listdir(directory):
    if filename.lower().endswith(image_extensions):
        filepath = os.path.join(directory, filename)
        with Image.open(filepath) as img:
            # Remove all extensions and add only .png
            base_name = filename
            while '.' in base_name:
                base_name = os.path.splitext(base_name)[0]
            png_filename = base_name + '.png'
            png_filepath = os.path.join(directory, png_filename)
            img.convert('RGBA').save(png_filepath, 'PNG')
            print(f"Converted {filename} -> {png_filename}")
            # Remove the original file after conversion
            os.remove(filepath)
            print(f"Removed original file: {filename}")