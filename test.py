import sys
import json
from nodes import PonyJsonPrompt

def main():
    if len(sys.argv) != 2:
        print("Usage:")
        print("  python test.py prompt.json")
        return

    json_file = sys.argv[1]

    with open(json_file, "r", encoding="utf-8") as f:
        data = f.read()
        
        jp = PonyJsonPrompt()
        prompt = jp.build_prompt(data,False)

        print("\n=== PONY PROMPT ===\n")
        print(prompt)
        print("\n===================\n")


if __name__ == "__main__":
    main()