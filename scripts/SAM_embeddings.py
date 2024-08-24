import torch
import numpy as np
from PIL import Image
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor

# use bfloat16 for the entire notebook
torch.autocast(device_type="cuda", dtype=torch.bfloat16).__enter__()

if torch.cuda.get_device_properties(0).major >= 8:
    # turn on tfloat32 for Ampere GPUs (https://pytorch.org/docs/stable/notes/cuda.html#tensorfloat-32-tf32-on-ampere-devices)
    torch.backends.cuda.matmul.allow_tf32 = True
    torch.backends.cudnn.allow_tf32 = True

def init_model():
    sam2_checkpoint = "scripts/sam2_hiera_large.pt"
    model_cfg = "sam2_hiera_l.yaml"

    sam2_model = build_sam2(model_cfg, sam2_checkpoint, device="cuda")

    return SAM2ImagePredictor(sam2_model)

def get_image_embedding(image_path, predictor):
    image = Image.open(image_path)
    image = np.array(image.convert("RGB"))

    predictor.reset_predictor()
    predictor.set_image(image)
    embeddings = predictor._features['image_embed'].cpu()
    high_res_feats = [ element.cpu() for element in predictor._features['high_res_feats']]

    return embeddings, high_res_feats
