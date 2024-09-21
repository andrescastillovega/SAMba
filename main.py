from fasthtml.common import *
import utils
import zipfile
import io
import os
import pickle
import scripts.SAM_embeddings as SAM
from PIL import Image as ImagePIL
import json
import numpy as np
import cv2

# Set up the database
db = database('db/SAMba.db')
imgs_table = db.t.images
classes_table = db.t.classes
annotations_table = db.t.annotations
if imgs_table not in db.t: imgs_table.create(id=int, project=str, id_img=int, img_height=int, img_width=int, img_path=str, sam2_embedding_path=str, sam2_hres_feats_path=str, pk='id')
if classes_table not in db.t: classes_table.create(id=int, project=str, annotation_class=str, class_id=int, color=str, pk='id')
if annotations_table not in db.t: annotations_table.create(id=int, project=str, id_img=int, class_id=int, points=str, cx=float, cy=float, width=float, height=float, angle=float, pk='id') 
Image = imgs_table.dataclass()
Class = classes_table.dataclass()
Annotations = annotations_table.dataclass()

# Set up the app
app, rt = fast_app(live=True, pico=True,
                   hdrs=[Link(rel="stylesheet", href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,700,0,20"),
                         Link(rel="stylesheet", href="../../static/css/annotate.css", type="text/css"),
                         Link(rel="stylesheet", href="../../static/css/create_project.css", type="text/css"),
                         Script(src="http://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js"),
                         Script(src="../../static/js/shortcuts.js"),
                         Script(src="../../static/js/modals.js")],)

# Toasts config
setup_toasts(app)

# General config
ANNOTATION_COLORS = [
    "#FF5733",  # Vibrant orange
    "#33FF57",  # Bright green
    "#3357FF",  # Deep blue
    "#F333FF",  # Vivid magenta
    "#33F9FF",  # Bright cyan
    "#FFC300",  # Strong yellow
    "#8C33FF",  # Purple
    "#FF5733",  # Red
    "#FFFFFF",  # White
    "#000000"   # Black
]

def update_class_id(val=0):
    return Input(id="class_id", type="text", hidden=True, hx_swap_oob='true', value=val)

def mk_class_input():
    return Input(id="class", type="text", placeholder="Add annotation class", hx_swap_oob='true')

@rt("/")
def get():
    project_name = Input(id="project_name", name="project_name", type="text", placeholder="Project Name")
    imgs_file = Input(id="imgs_file", name="imgs_file", type="file")
    project_section = (H1("SAM Image Annotator"), Section((Div(Div(project_name), Div(imgs_file), cls='grid'))))

    add_class_button = A(Span("add_circle", cls="material-symbols-outlined"), style="color: #75FB4C; font-size: 2em;",
                          hx_post='/add_class', target_id='class-list', hx_swap='beforeend')
    
    class_section = (H2("Annotation Classes"),
                         update_class_id(), 
                         Div(mk_class_input(),
                             Div(add_class_button),
                             cls="grid"),
                         Ul(id='class-list'))
    
    upload_button = Button("Upload")
    upload_imgs = Form((project_section, class_section, upload_button), action="/extract_images", enctype="multipart/form-data", method="post", accept="application/zip")
    return Title("SAM Image Annotator"), Main(upload_imgs, cls="container", style="width: 50%"), utils.file_ext_modal() 

@rt("/add_class")
async def post(request:Request):
    form = await request.form()
    class_id = int(form['class_id']) + 1
    delete_class_button = A(Span("delete", cls="material-symbols-outlined"), style="color: #EA3323; vertical-align: middle; ",
                            hx_post=f'/delete_class', target_id=f'class-{class_id}', hx_swap='delete')
    return Div(
            Div(Li(Kbd(class_id), B(f" {form['class']}"), Input(id=f"color-{class_id}",type="color", value=ANNOTATION_COLORS[class_id - 1]), style="list-style-type:none;")),
            Input(type="hidden", id=f"class-id-{class_id}", value=form['class']),
            Div(delete_class_button, style="align:right;", id=f'class-{class_id}'),
            cls="grid", id=f'class-{class_id}'), update_class_id(class_id), mk_class_input()


@rt("/delete_class")
async def post(request:Request):
    form = await request.form()
    class_id = int(form['class_id']) - 1
    return update_class_id(class_id), mk_class_input()



@rt("/extract_images")
async def post(request:Request):
    imgs_request = await request.form()
    project_name = imgs_request['project_name']
    classes = [items for items in imgs_request.items() if 'class-id' in items[0]]
    colors = [colors for colors in imgs_request.items() if 'color' in colors[0]]
    print(colors)

    for class_id, class_name in classes:
        id = int(class_id.split('-')[-1])
        annotation_class = Class(project=project_name, annotation_class=class_name, class_id=id, color=colors[id - 1][1])
        classes_table.insert(annotation_class)

    for dir in ['images', 'embeddings', 'high_res_feats']:
        os.makedirs(f"static/{dir}/{project_name}", exist_ok=True)

    file_bytes = await imgs_request['imgs_file'].read()
    imgs_zip = zipfile.ZipFile(io.BytesIO(file_bytes))
    imgs_zip.extractall(f"static/images/{project_name}")

    predictor = SAM.init_model()

    images = os.listdir(f"static/images/{project_name}")
    images.sort()

    for id_img, img in enumerate(images):
        img_path = f"static/images/{project_name}/{img}"
        img_embedding, img_high_res_features = SAM.get_image_embedding(img_path, predictor)

        img_emb_path = f"static/embeddings/{project_name}/{img.split('.')[0]}.pkl"
        img_hres_feats_path = f"static/high_res_feats/{project_name}/{img.split('.')[0]}.pkl"

        with open(img_emb_path, 'wb') as f:
            pickle.dump(img_embedding, f)

        with open(img_hres_feats_path, 'wb') as f:
            pickle.dump(img_high_res_features, f)

        with ImagePIL.open(img_path) as file:
            width, height = file.size
        file.close()

        img_obj = Image(project=project_name, id_img=id_img + 1, img_width=width, img_height=height, img_path=img_path, sam2_embedding_path=img_emb_path, sam2_hres_feats_path=img_hres_feats_path)
        imgs_table.insert(img_obj)

    return RedirectResponse(url=f"/annotate/{project_name}/{1}", status_code=303) # 303 is the code to redirect GET after a POST request

def get_img(path:str, img_width:int, img_height:int):
    svg = Svg(id="canvas", width=img_width, height=img_height) 
    img_container = Div(Div(svg), id="img-container", cls="container")
    return img_container

@rt("/annotate/{project_name:str}/{id_image:int}")
def get(project_name:str, id_image:int):
    img = db.q(f"SELECT * FROM images WHERE project = '{project_name}' AND id_img = {id_image}")
    nimgs =  db.q(f"SELECT COUNT(id_img) AS nimages FROM images WHERE project = '{project_name}'")[0]['nimages']
    annotation_classes = db.q(f"SELECT * FROM classes WHERE project = '{project_name}' ORDER BY class_id ASC")
    
    id_img = Input(id="id_img", type="hidden", value=id_image)
    project = Input(id="project", type="hidden", value=project_name)
    img_path = Input(id="img_path", type="hidden", value=img[0]['img_path'])
    width = Input(id="img_width", type="hidden", value=img[0]['img_width'])
    height = Input(id="img_height", type="hidden", value=img[0]['img_height'])
    annotation_class = Input(id="class", type="hidden", value=1)
    properties = (id_img, project, img_path, width, height, annotation_class)

    if id_image == 1:
        prev_button = A("Previous", id="prev-button", disabled=True, cls="button")
    else:
        prev_button = A("Previous", id="prev-button", href=f"/change_img/{project_name}/{id_image}/previous", cls="button")

    current_img = H3(f"Image {id_image} of {nimgs}")

    if id_image == nimgs:
        next_button = A("Next", id="next-button", disabled=True, cls="button")
    else:
        next_button = A("Next", id="next-button", href=f"/change_img/{project_name}/{id_image}/next", cls="button")

    shortcuts_button = A(id="shortcutsButton", cls="shortcuts-button")
    export_button = A(Span("file_download", cls="material-symbols-outlined"), "Export annotations", 
                      href=f"/export/{project_name}", cls="export-button")
        
    classes_title = Div(H3("Annotation classes"), cls="centered-div")
    classes_list = []
    for annotation_class in annotation_classes:
        classes_list.append(
            Div(Kbd(f"{annotation_class['class_id']}"), B(f"{annotation_class['annotation_class']}"), cls="class-label", id=f"class-{annotation_class['class_id']}", color=f"{annotation_class['color']}")
        )
    classes_div = Div(Div(tuple(classes_list), cls="grid"), cls="container")

    footer = Footer((classes_title, classes_div))

    shortcuts_section = Div(Div(Div(export_button, cls="centered-div"), Div(), Div(), Div(shortcuts_button, cls="centered-div"), cls="grid"), cls="container")

    buttons = Div(Div(Div(prev_button, cls="centered-div"), Div(current_img, cls="centered-div"), Div(next_button, cls="centered-div"), cls="grid"), cls="container")
    js_scripts = (
            Script(src="../../static/js/canvas.js"),
            Script(src="../../static/js/prompt.js"),
            Script(src="../../static/js/editAnnotation.js"),
            Script(src="../../static/js/edit_mode/dragAnnotation.js"),
            Script(src="../../static/js/edit_mode/resizeAnnotation.js"),
            Script(src="../../static/js/edit_mode/rotateAnnotation.js")
    )
    return Title("SAM Image Annotator"), Main(properties, shortcuts_section, buttons, get_img(img[0]['img_path'], img[0]['img_width'], img[0]['img_height']), id="main"), footer, utils.shortcuts_modal(), js_scripts 

@rt("/change_img/{project_name}/{id_image}/{action}")
def get(project_name:str, id_image: int, action:str):
    if action == 'previous':
        id_image -= 1
    elif action == 'next':
        id_image += 1
    return RedirectResponse(url=f"/annotate/{project_name}/{id_image}")

@rt('/infer/{project}/{id_img}/{class_id}')
async def post(project:str, id_img:int, class_id:int, request:Request):    
    data = await request.body()
    data = json.loads(data.decode('utf-8'))
    points = np.array(data["points"])
    labels = np.array(data["labels"])

    predictor = SAM.init_model()

    query = db.q(f"SELECT * FROM images WHERE project = '{project}' AND id_img = {id_img}")
    color = db.q(f"SELECT color FROM classes WHERE project = '{project}' AND class_id = {class_id}")[0]['color']
    img_path = query[0]["img_path"]
    embeddings_path = query[0]["sam2_embedding_path"]
    hres_path = query[0]["sam2_hres_feats_path"]

    img = ImagePIL.open(img_path)
    img = np.array(img.convert("RGB"))

    with open(f'{embeddings_path}', 'rb') as f:
        embeddings = pickle.load(f)

    with open(f'{hres_path}', 'rb') as f:
        high_res_feats = pickle.load(f)

    # Send the embeddings and high_res_feats to the predictor device
    embeddings = embeddings.to(predictor.device)
    high_res_feats = [ele.to(predictor.device) for ele in high_res_feats]

    predictor._features = {'image_embed': embeddings, 'high_res_feats': high_res_feats}

    predictor._orig_hw = [img.shape[:2]]
    input_image = predictor._transforms(img)
    input_image = input_image[None, ...].to(predictor.device)
    predictor._is_image_set = True

    masks, scores, logits = predictor.predict(
        point_coords=points,
        point_labels=labels,
        multimask_output=True,
    )
    sorted_ind = np.argsort(scores)[::-1]
    masks = masks[sorted_ind][0]
    scores = scores[sorted_ind]
    logits = logits[sorted_ind]

    h, w = masks.shape[-2:]
    mask = masks.astype(np.uint8)

    contours, _ = cv2.findContours(mask,cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    min_area_rect = cv2.minAreaRect(contours[0])
    center, dims, rot_angle = min_area_rect
    box = cv2.boxPoints(min_area_rect)

    return json.dumps({"class_id": class_id, "color": color, "mask": contours[0].tolist(),
                       "cx": center[0], "cy": center[1], "width": dims[0], "height": dims[1],
                       "angle": rot_angle})

@rt('/save_annotation/{project}/{id_img}/{class_id}')
async def post(request:Request, project:str, id_img:int, class_id:int):
    data = await request.body()
    data = json.loads(data.decode('utf-8'))
    annotation = Annotations(project=project, id_img=id_img, class_id=class_id, 
                             points=str(data["mask"]), cx=data["cx"], cy=data["cy"],
                             width=data["width"], height=data["height"], angle=data["angle"])
    annotation = annotations_table.insert(annotation)
    data['id'] = annotation.id
    return data

@rt('/delete_annotation/{annotation_id}')
def get(annotation_id:int):
    annotations_table.delete(annotation_id)
    return None

@rt('/get_annotations/{project}/{id_img}')
def get(project:str, id_img:int):
    query = db.q(f"""SELECT annotations.*, classes.color
                   FROM annotations
                   LEFT JOIN classes ON annotations.class_id = classes.class_id
                   WHERE annotations.project = '{project}' AND annotations.id_img = {id_img};""")
    query = [ {"id": q['id'], "class_id": q['class_id'], "color": q['color'],
               "mask": json.loads(q['points']), "cx": q["cx"], "cy": q["cy"], "height": q["height"],
               "width": q["width"], "angle": q["angle"]} for q in query ]
    return Response(content=json.dumps(query), media_type='application/json', status_code=201)

@rt('/update_annotation/{id_annotation}')
async def post(request:Request, id_annotation:int):
    data = await request.body()
    data = json.loads(data.decode('utf-8'))
    annotation = annotations_table.get(id_annotation)
    annotation.cx = data['center'][0]
    annotation.cy = data['center'][1]
    annotation.width = data['width']
    annotation.height = data['height']
    annotation.angle = data['angle']
    annotations_table.update(annotation)
    return None
    




@rt("/export/{project_name:str}")
def get(project_name: str):
    classes = db.q(f"SELECT * FROM classes WHERE project = '{project_name}' ORDER BY class_id ASC")
    
    export_form = Form(
        H2("Export Annotations"),
        Select(
            Option("YOLO", value="yolo"),
            Option("COCO", value="coco"),
            Option("Pascal VOC", value="pascal_voc"),
            name="format",
            id="export-format"
        ),
        Button("Export", type="submit"),
        action=f"/generate_export/{project_name}",
        method="post"
    )
    
    return Title("Export Annotations"), Main(export_form, cls="container", style="width: 50%")

@rt("/generate_export/{project_name:str}")
async def post(request: Request, project_name: str):
    form = await request.form()
    export_format = form['format']
    
    annotations = db.q(f"""
        SELECT a.*, c.annotation_class, i.img_path, i.img_width, i.img_height
        FROM annotations a
        JOIN classes c ON a.class_id = c.class_id AND a.project = c.project
        JOIN images i ON a.id_img = i.id_img AND a.project = i.project
        WHERE a.project = '{project_name}'
    """)
    
    if export_format == 'yolo':
        content = generate_yolo_format(annotations)
    elif export_format == 'coco':
        content = generate_coco_format(annotations)
    elif export_format == 'pascal_voc':
        content = generate_pascal_voc_format(annotations)
    else:
        return "Invalid format", 400
    
    return Response(
        content=content,
        media_type='text/plain',
        headers={
            'Content-Disposition': f'attachment; filename="{project_name}_annotations_{export_format}.txt"'
        }
    )

def generate_yolo_format(annotations):
    yolo_annotations = []
    for ann in annotations:
        class_id = ann['class_id'] - 1  # YOLO uses 0-indexed class IDs
        x_center = ann['cx'] / ann['img_width']
        y_center = ann['cy'] / ann['img_height']
        width = ann['width'] / ann['img_width']
        height = ann['height'] / ann['img_height']
        yolo_annotations.append(f"{class_id} {x_center} {y_center} {width} {height}")
    return "\n".join(yolo_annotations)

def generate_coco_format(annotations):
    coco_data = {
        "images": [],
        "annotations": [],
        "categories": []
    }
    image_id_map = {}
    for ann in annotations:
        if ann['id_img'] not in image_id_map:
            image_id_map[ann['id_img']] = len(coco_data["images"])
            coco_data["images"].append({
                "id": image_id_map[ann['id_img']],
                "file_name": ann['img_path'],
                "width": ann['img_width'],
                "height": ann['img_height']
            })
        coco_data["annotations"].append({
            "id": ann['id'],
            "image_id": image_id_map[ann['id_img']],
            "category_id": ann['class_id'],
            "bbox": [ann['cx'] - ann['width']/2, ann['cy'] - ann['height']/2, ann['width'], ann['height']],
            "area": ann['width'] * ann['height'],
            "iscrowd": 0
        })
    coco_data["categories"] = [{"id": ann['class_id'], "name": ann['annotation_class']} for ann in annotations]
    return json.dumps(coco_data, indent=2)

def generate_pascal_voc_format(annotations):
    voc_annotations = []
    for ann in annotations:
        voc_ann = f"""
<annotation>
    <folder>{ann['project']}</folder>
    <filename>{ann['img_path'].split('/')[-1]}</filename>
    <path>{ann['img_path']}</path>
    <source>
        <database>Unknown</database>
    </source>
    <size>
        <width>{ann['img_width']}</width>
        <height>{ann['img_height']}</height>
        <depth>3</depth>
    </size>
    <segmented>0</segmented>
    <object>
        <name>{ann['annotation_class']}</name>
        <pose>Unspecified</pose>
        <truncated>0</truncated>
        <difficult>0</difficult>
        <bndbox>
            <xmin>{max(0, int(ann['cx'] - ann['width']/2))}</xmin>
            <ymin>{max(0, int(ann['cy'] - ann['height']/2))}</ymin>
            <xmax>{min(ann['img_width'], int(ann['cx'] + ann['width']/2))}</xmax>
            <ymax>{min(ann['img_height'], int(ann['cy'] + ann['height']/2))}</ymax>
        </bndbox>
    </object>
</annotation>
"""
        voc_annotations.append(voc_ann)
    return "\n".join(voc_annotations)






serve()
