import json

# https://whatlab.ai/guides/pony-prompting-guide
# https://civitai.red/articles/31430/comprehensive-guide-to-prompt-engineering-for-sexual-pose-generation-in-pony-diffusion
#
# score_9, score_8_up, score_7_up, score_6_up, score_5_up, score_4_up [quality modifiers], 
# [source style], [subject count], [subject description], [pose/action], [clothing], [setting], [lighting], [composition]
#

class PonyJsonPrompt:

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "json_text": ("STRING", {
                    "multiline": True,
                    "default": '{"quality":["score_9","score_8_up","score_7_up","rating_explicit"],\n"subject":["1girl"],\n"description":["18yo","blonde hair","slim","cute face"],\n"pose":["lying on tanning chair"],\n"clothing":["blue towel under"],\n"environment":["pool in background"],\n"lighting":["bright sunlight"],\n"composition":["full body"],\n"boosters":["realistic skin","high quality","masterpiece","cinematic"]}'
                }),
                "linebreak": ("BOOLEAN", {
                    "default": False
                })
            }
        }

    RETURN_TYPES = ("STRING","STRING")
    RETURN_NAMES = ("prompt","prettyJson")
    FUNCTION = "build_prompt"
    CATEGORY = "prompt"

    SECTION_ORDER = [
        "quality",
        "source",
        "subject",
        "body",
        "description",
        "expression",
        "pose",
        "action",
        "clothing",
        "camera",
        "settings",
        "environment",
        "lighting",
        "style",
        "composition",
        "boosters"
    ]

    def build_prompt(self, json_text, linebreak):
        try:
            data = json.loads(json_text)
        except Exception as e:
            return (f"JSON ERROR: {e}",)

        sections = []
        sep = ", "

        if linebreak:
            sep = ",\n"

        for section in self.SECTION_ORDER:
            values = data.get(section)

            if not values:
                continue

            if isinstance(values, str):
                values = [values]

            values = [
                str(v).strip()
                for v in values
                if str(v).strip()
            ]

            if values:
                sections.append(", ".join(values))

        prompt = sep.join(sections)

        return (prompt,json.dumps(data,indent=2))


NODE_CLASS_MAPPINGS = {
    "PonyJsonPrompt": PonyJsonPrompt
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PonyJsonPrompt": "Pony JSON to Prompt"
}