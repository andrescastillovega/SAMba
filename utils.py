from fasthtml.common import *

def Modal():
    modal = Dialog(
      Article(
        H2("Error - File extension!"),
        P("You can only upload the images as a zip file"),
        Footer(
          Button("Got it!", _id="modalExtButton")
        )
      ),
    _id="modalExt")

    return modal