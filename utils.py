from fasthtml.common import *

def file_ext_modal():
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

def shortcuts_modal():
    modal = Dialog(
      Article(
        H2("Keyboard shortcuts"),
        # other_ks_title = Div(H3("Keyboard shorcuts"), cls="centered-div")
        Div(
            Div(
                (Div(Kbd("q"), B("Previous image")),
                Div(Kbd("w"), B("Next image")),
                Div(Kbd("i"), B("Infer class")),
                Div(Kbd("c"), B("Clear prompt points")),
                Div(Kbd("e"), B("Edit mode")),
                Div(Kbd("d"), B("Delete annotation (only edit mode)"))),
                cls="grid")
            , cls="container"),
        Footer(
          Button("Close", _id="modalShortcutsButton")
        )
      ),
    _id="modalShortcuts")

    return modal
