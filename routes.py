import os
import json
from pathlib import Path
import folder_paths
from server import PromptServer
from aiohttp import web

def make_file_path(name):

    ext = ".json"
    if ".json" in name:
        ext =""

    if "*" not in name: 
        return os.path.join(folder_paths.user_directory,"templates",name)+ext

    num = 0
    while True:
        num = num+1
        if num == 1000:
            new_path = ""
            break

        new_name = name.replace("*",f"{num:03d}")
        new_path = os.path.join(folder_paths.user_directory,"templates",new_name)+ext
        if not os.path.exists(new_path):
            break

    return new_path


def setup_routes():

    folder_paths.folder_names_and_paths["templates"] = ([os.path.join(folder_paths.user_directory, "templates")],{".json"})

    @PromptServer.instance.routes.get("/user/templates")
    async def get_templates(request):
        return web.json_response(folder_paths.get_filename_list("templates"))

    @PromptServer.instance.routes.get("/user/template/{name}")
    async def get_template(request):
        name = request.match_info['name']
        fpath = os.path.join(folder_paths.user_directory,"templates",name)
        with open(fpath, "r") as file:
            content = file.read()
            return web.Response(text=content)
        
    @PromptServer.instance.routes.post("/user/template")
    async def post_template(request):

        data = await request.json()
        print("data",data)
        #print("Save template",json.dumps(data))

        name = data['name']
        print("name",name)
        fpath = make_file_path(name)
        print("path",fpath)
        
        if fpath == "":
            return web.json_response('{rslt:1, msg:"invalid filename",filename:"'+name+'", len:0}')
        
        content = data['content']
        with open(fpath, "w") as file:
            file.write(content)
            return web.json_response('{rslt:0, msg:"file saved","filename:"'+os.path.basename(fpath)+'", len:'+str(len(content))+'}')

