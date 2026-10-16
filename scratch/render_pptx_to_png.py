import sys
import os
import win32com.client

def render(pptx_path, out_dir):
    abs_pptx = os.path.abspath(pptx_path)
    abs_out = os.path.abspath(out_dir)
    os.makedirs(abs_out, exist_ok=True)

    print(f"Opening PowerPoint to render: {abs_pptx}")
    ppt_app = win32com.client.Dispatch("PowerPoint.Application")
    try:
        pres = ppt_app.Presentations.Open(abs_pptx, WithWindow=False)
        pres.Export(abs_out, "PNG", 1920, 1080)
        pres.Close()
        print(f"Successfully exported slides to {abs_out}")
    finally:
        ppt_app.Quit()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python render_pptx_to_png.py <pptx_path> <out_dir>")
        sys.exit(1)
    render(sys.argv[1], sys.argv[2])
