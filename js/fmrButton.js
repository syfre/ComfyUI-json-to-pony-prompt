import { app } from "../../scripts/app.js";

app.registerExtension({
    name: "syfre.jsontoponyprompt.fmtButton",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "PonyJsonPrompt")
            return;

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;

        nodeType.prototype.onNodeCreated = function () {
            const r = origOnNodeCreated?.apply(this, arguments);

            
            this.addWidget(
                "button",
                "Format json",
                null,
                () => {
                    const promptWidget = this.widgets.find(
                        w => w.name === "json_text"
                    );

                    if (!promptWidget) return;

                    promptWidget.value = formatPrompt(
                        promptWidget.value
                    );

                    this.setDirtyCanvas(true, true);
                }
            );
            
            this.addWidget(
                "button",
                "apply template",
                null,
                async (value,widget,node) =>  {
                    const templates = await fetch("/user/templates")
                    .then(r => r.json()).then((templates)=>{

                        const event = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true,
                            clientX: node.graph._canvas.last_click_position[0],
                            clientY: node.graph._canvas.last_click_position[1]
                        });


                        new LiteGraph.ContextMenu(
                            templates,
                            {
                                callback: async (selected) => {
                                    
                                    console.log("selected",{selected})
                                    const template =  await fetch("/user/template/"+selected)
                                    .then(r => r.text()).then((content)=>{
                                        console.log("content",{content})
                                        try {
                                            const jst = JSON.parse(content || "{}");
                                            console.log("json.content",{jst})

                                            const promptWidget = this.widgets.find(
                                                w => w.name === "json_text"
                                            );

                                            if (promptWidget) {

                                                const jsp = JSON.parse(promptWidget.value || "{}");
                                                const jsm = mergeObjects(jsp,jst)
                                                promptWidget.value = JSON.stringify(jsm, null, 2);
                                                this.setDirtyCanvas(true, true);
                                            } 

                                        } catch (e) {
                                            console.log("template.exception",{e})
                                        }                                          

                                    })
                                    
                                },
                                event:event
                            }
                        );
                    });                    
                }
            );
            
            this.addWidget(
                "button",
                "Save as template",
                null,
                 () => {
                    const promptWidget = this.widgets.find(
                        w => w.name === "json_text"
                    );

                    if (!promptWidget) return;

                    app.extensionManager.dialog.prompt({
                    title: "Saving as a template",
                    message: "Please enter the template name:",
                    defaultValue: "template_*"
                    }).then( async (result) => {
                    if (result !== null) {
                        console.log(`Input: ${result}`);
                        await fetch("/user/template",{method:"POST", body:JSON.stringify({name:result, content:promptWidget.value})})
                        .then(r => r.json()).then((rslt)=>{
                            console.log(rslt)
                        })
                    }
                    });
                }
            );

            return r;
        };
    }
});

/*
 "others": [
    "two girls",
    "petite",
    "dildo riding",
    "trending on 500px",
    "vignette",
    "high definition"
  ]  ]
*/

const jsonEmpty = '{"quality":[],\n"source":[],\n"subject":[],\n"description":[],\n"pose":[],\n"clothing":[],\n"environment":[],\n"lighting":[],\n"composition":[],\n"style":[],\n"boosters":[],\n"others":[]}'
const jsonDefault = '{"quality":["score_9","score_8_up","score_7_up","rating_explicit"],\n"subject":["1girl"],\n"description":["18yo","blonde hair","slim","cute face"],\n"pose":["lying on tanning chair"],\n"clothing":["blue towel under"],\n"environment":["pool in background"],\n"lighting":["bright sunlight"],\n"composition":["full body"],\n"boosters":["realistic skin","high quality","masterpiece","cinematic"]}'


function mergeObjects(obj1, obj2) {
  const result = { ...obj1, ...obj2 };

  for (const key of Object.keys(obj1)) {
    if (Array.isArray(obj1[key]) && Array.isArray(obj2[key])) {
      result[key] = [... new Set( [...obj1[key], ...obj2[key]] ) ];
    }
  }
  return result;
}

function splitOutsideParens(str) {
  const result = {strings:[], loras:[]};
  let current = '';
  let depth = 0;
  let lora = 0;

  for (const ch of str) {
    if (ch==='\n') continue;
    if (ch === '(') depth++;
    if ((ch === ')') && (depth>0)) depth--;
    //
    if (ch === '<') {
        lora++;
        if (lora===1) current='';
    }
    //
    if ((ch === '>') && (lora>0)) {
        lora--;
        if (lora===0) {
            current += ch;
            result.loras.push(current);
            current = '';
            continue;
        }
    }
    //
    if (ch === ',' && depth === 0 && lora===0) {
    if (current!='BREAK') result.strings.push(current.trim());
    current = '';
    } else {
    current += ch;
    }
  }

  result.strings.push(current.trim());
  return result;
}

function containsWord(str, word) {
  return new RegExp(`\\b${word}\\b`).test(str);
}

function toJson(text) {

    let rslt = JSON.parse(jsonEmpty);
    const data = splitOutsideParens(text.replace(/BREAK/g, ""));
    const str_array = data.strings;

    for(var i = 0; i < str_array.length; i++) {
        const str = str_array[i];
        const strL = str.toLowerCase().replace("_"," ");

        
        str.startsWith("score")  ? rslt.quality.push(str) :
        str.startsWith("Score")  ? rslt.quality.push(str.toLowerCase()) :
        str.startsWith("rating") ? rslt.quality.push(str) :
        str.startsWith("source") ? rslt.source.push(str) :
        //
        containsWord(strL,"1girl")    ? rslt.subject.push(str) :
        containsWord(strL,"2girl")    ? rslt.subject.push(str) :
        containsWord(strL,"2girls")    ? rslt.subject.push(str) :
        containsWord(strL,"one girl")  ? rslt.subject.push(str) :
        containsWord(strL,"hot girl")  ? rslt.subject.push(str) :
        containsWord(strL,"two girls")  ? rslt.subject.push(str) :
        containsWord(strL,"beautiful girl") ? rslt.subject.push(str) :
        containsWord(strL,"1woman")    ? rslt.subject.push(str) :
        containsWord(strL,"beautiful woman") ? rslt.subject.push(str) :
        containsWord(strL,"young girl") ? rslt.subject.push(str) :
        containsWord(strL,"1boy")     ? rslt.subject.push(str) :
        containsWord(strL,"2boy")    ? rslt.subject.push(str) :
        containsWord(strL,"2boys")    ? rslt.subject.push(str) :
        containsWord(strL,"2man")     ? rslt.subject.push(str) :
        containsWord(strL,"2men")     ? rslt.subject.push(str) :
        containsWord(strL,"two boys")  ? rslt.subject.push(str) :
        containsWord(strL,"couple")    ? rslt.subject.push(str) :
        containsWord(strL,"gangbang")  ? rslt.subject.push(str) :
        containsWord(strL,"gang bang")  ? rslt.subject.push(str) :
        containsWord(strL,"old man")    ? rslt.subject.push(str) :
        containsWord(strL,"middle age") ? rslt.subject.push(str) :
        containsWord(strL,"elderly")    ? rslt.subject.push(str) :
        containsWord(strL,"milf") ? rslt.subject.push(str) :
        containsWord(strL,"mature") ? rslt.subject.push(str) :
        containsWord(strL,"years")    ? rslt.subject.push(str) :
        //
        containsWord(strL,"russian")  ? rslt.subject.push(str) :
        containsWord(strL,"nordic") ? rslt.subject.push(str) :
        containsWord(strL,"japanese") ? rslt.subject.push(str) :
        containsWord(strL,"asian") ? rslt.subject.push(str) :
        containsWord(strL,"african") ? rslt.subject.push(str) :
        containsWord(strL,"european") ? rslt.subject.push(str) :
        //
        containsWord(strL,"blonde")   ? rslt.description.push(str) :
        containsWord(strL,"brunette") ? rslt.description.push(str) :
        containsWord(strL,"model")    ? rslt.description.push(str) :
        containsWord(strL,"old")      ? rslt.description.push(str) :
        containsWord(strL,"age")      ? rslt.description.push(str) :
        containsWord(strL,"perfect")      ? rslt.description.push(str) :
        containsWord(strL,"beauty")      ? rslt.description.push(str) :
        containsWord(strL,"youthful")      ? rslt.description.push(str) :
        //
        containsWord(strL,"face")     ? rslt.description.push(str) :
        containsWord(strL,"freckles") ? rslt.description.push(str) :
        containsWord(strL,"dimples")  ? rslt.description.push(str) :
        containsWord(strL,"skin")     ? rslt.description.push(str) :
        containsWord(strL,"pores")     ? rslt.description.push(str) :
        containsWord(strL,"makeup")   ? rslt.description.push(str) :
        containsWord(strL,"tanlines")   ? rslt.description.push(str) :
        containsWord(strL,"tattoos")   ? rslt.description.push(str) :
        //            
        containsWord(strL,"nude")   ? rslt.description.push(str) :
        containsWord(strL,"undressing")   ? rslt.description.push(str) :
        containsWord(strL,"undressed")   ? rslt.description.push(str) :
        containsWord(strL,"shaved")   ? rslt.description.push(str) :
        containsWord(strL,"unshaved")  ? rslt.description.push(str) :
        containsWord(strL,"topless")      ? rslt.description.push(str) :
        containsWord(strL,"wet")  ? rslt.description.push(str) :
        //
        containsWord(strL,"hair")     ? rslt.description.push(str) :
        containsWord(strL,"hairstyle")     ? rslt.description.push(str) :
        containsWord(strL,"pigtails") ? rslt.description.push(str) :
        containsWord(strL,"ponytail") ? rslt.description.push(str) :
        containsWord(strL,"headwrap") ? rslt.description.push(str) :
        containsWord(strL,"braids") ? rslt.description.push(str) :
        containsWord(strL,"bangs") ? rslt.description.push(str) :
        containsWord(strL,"haircut")  ? rslt.description.push(str) :
        containsWord(strL,"hime cut")  ? rslt.description.push(str) :
        //
        containsWord(strL,"slender")  ? rslt.description.push(str) :
        containsWord(strL,"petite")     ? rslt.description.push(str) :
        containsWord(strL,"slim")     ? rslt.description.push(str) :
        containsWord(strL,"skinny")   ? rslt.description.push(str) :
        containsWord(strL,"muscular")   ? rslt.description.push(str) :
        containsWord(strL,"curves")   ? rslt.description.push(str) :
        containsWord(strL,"fit")   ? rslt.description.push(str) :
        containsWord(strL,"sporty")   ? rslt.description.push(str) :
        containsWord(strL,"puffy")    ? rslt.description.push(str) :
        containsWord(strL,"hairy")    ? rslt.description.push(str) :
        //
        containsWord(strL,"head")    ? rslt.description.push(str) :
        containsWord(strL,"eyes")     ? rslt.description.push(str) :
        containsWord(strL,"eyebrows") ? rslt.description.push(str) :
        containsWord(strL,"eyeshadow") ? rslt.description.push(str) :
        containsWord(strL,"eyelashes") ? rslt.description.push(str) :
        containsWord(strL,"eyeliner") ? rslt.description.push(str) :
        containsWord(strL,"breast")   ? rslt.description.push(str) :
        containsWord(strL,"breasts")  ? rslt.description.push(str) :
        containsWord(strL,"boobs")  ? rslt.description.push(str) :
        containsWord(strL,"areola")  ? rslt.description.push(str) :
        containsWord(strL,"areolas")  ? rslt.description.push(str) :
        containsWord(strL,"cleavage")  ? rslt.description.push(str) :
        containsWord(strL,"tit")     ? rslt.description.push(str) :
        containsWord(strL,"tits")     ? rslt.description.push(str) :
        containsWord(strL,"nipple")  ? rslt.description.push(str) :
        containsWord(strL,"nipples")  ? rslt.description.push(str) :
        containsWord(strL,"pubic")    ? rslt.description.push(str) :
        containsWord(strL,"mouth")    ? rslt.description.push(str) :
        containsWord(strL,"cheeks")    ? rslt.description.push(str) :
        containsWord(strL,"jawline")    ? rslt.description.push(str) :
        containsWord(strL,"ears")     ? rslt.description.push(str) :
        containsWord(strL,"lips")     ? rslt.description.push(str) :
        containsWord(strL,"nose")     ? rslt.description.push(str) :
        containsWord(strL,"tongue")   ? rslt.description.push(str) :
        containsWord(strL,"belly")    ? rslt.description.push(str) :
        containsWord(strL,"waist")    ? rslt.description.push(str) :
        containsWord(strL,"shoulders")  ? rslt.description.push(str) :
        containsWord(strL,"arms")     ? rslt.description.push(str) :
        containsWord(strL,"armpits")  ? rslt.description.push(str) :
        containsWord(strL,"hands")  ? rslt.description.push(str) :
        containsWord(strL,"navel")  ? rslt.description.push(str) :
        containsWord(strL,"hip")      ? rslt.description.push(str) :
        containsWord(strL,"hips")      ? rslt.description.push(str) :
        containsWord(strL,"thighs")   ? rslt.description.push(str) :
        containsWord(strL,"ass")      ? rslt.description.push(str) :
        containsWord(strL,"roundass")      ? rslt.description.push(str) :
        containsWord(strL,"buttcheeks")      ? rslt.description.push(str) :
        containsWord(strL,"buttocks")      ? rslt.description.push(str) :
        containsWord(strL,"butt")      ? rslt.description.push(str) :
        containsWord(strL,"bun")      ? rslt.description.push(str) :
        containsWord(strL,"legs")      ? rslt.description.push(str) :
        containsWord(strL,"feet")     ? rslt.description.push(str) :
        //
        containsWord(strL,"pussy")    ? rslt.description.push(str) :
        containsWord(strL,"vagina")   ? rslt.description.push(str) :
        containsWord(strL,"labia")    ? rslt.description.push(str) :
        containsWord(strL,"anus")    ? rslt.description.push(str) :
        containsWord(strL,"dick")     ? rslt.description.push(str) :
        containsWord(strL,"cock")     ? rslt.description.push(str) :
        containsWord(strL,"penis")     ? rslt.description.push(str) :
        containsWord(strL,"balls")     ? rslt.description.push(str) :
        containsWord(strL,"testicles")  ? rslt.description.push(str) :
        //
        containsWord(strL,"girly")     ? rslt.description.push(str) :
        containsWord(strL,"attractive")  ? rslt.description.push(str) :
        containsWord(strL,"feminine")  ? rslt.description.push(str) :
        containsWord(strL,"amateur")     ? rslt.description.push(str) :
        containsWord(strL,"lilycat")    ? rslt.description.push(str) :
        containsWord(strL,"look")     ? rslt.description.push(str) :
        containsWord(strL,"seductive")  ? rslt.description.push(str) :
        containsWord(strL,"adorable") ? rslt.description.push(str) :
        containsWord(strL,"happy")    ? rslt.description.push(str) :
        containsWord(strL,"smile")    ? rslt.description.push(str) :
        containsWord(strL,"smiling")  ? rslt.description.push(str) :
        containsWord(strL,"smirk")    ? rslt.description.push(str) :
        containsWord(strL,"blush")    ? rslt.description.push(str) :
        containsWord(strL,"expression") ? rslt.description.push(str) :
        containsWord(strL,"expressionless")    ? rslt.description.push(str) :
        containsWord(strL,"expressiveh")  ? rslt.description.push(str) :
        containsWord(strL,"exhausted")  ? rslt.description.push(str) :
        containsWord(strL,"confident")  ? rslt.description.push(str) :
        containsWord(strL,"embarrassed")  ? rslt.description.push(str) :
        containsWord(strL,"scared")  ? rslt.description.push(str) :
        containsWord(strL,"despair")  ? rslt.description.push(str) :
        containsWord(strL,"surprised")  ? rslt.description.push(str) :
        containsWord(strL,"curious")  ? rslt.description.push(str) :
        containsWord(strL,"curious")  ? rslt.description.push(str) :
        containsWord(strL,"horny")  ? rslt.description.push(str) :
        containsWord(strL,"shy")  ? rslt.description.push(str) :
        containsWord(strL,"dancer")  ? rslt.description.push(str) :
        containsWord(strL,"pregnant")  ? rslt.description.push(str) :
        //
        containsWord(strL,"creampie")  ? rslt.description.push(str) :
        containsWord(strL,"cum")  ? rslt.description.push(str) :
        containsWord(strL,"saliva")  ? rslt.description.push(str) :
        //
        containsWord(strL,"up")       ? rslt.pose.push(str) :
        containsWord(strL,"down")     ? rslt.pose.push(str) :
        containsWord(strL,"standing") ? rslt.pose.push(str) :
        containsWord(strL,"lying")    ? rslt.pose.push(str) :
        containsWord(strL,"sitting")    ? rslt.pose.push(str) :
        containsWord(strL,"holding")  ? rslt.pose.push(str) :
        containsWord(strL,"squatting") ? rslt.pose.push(str) :
        containsWord(strL,"spitting") ? rslt.pose.push(str) :
        containsWord(strL,"kneeling") ? rslt.pose.push(str) :
        containsWord(strL,"hand")     ? rslt.pose.push(str) :
        containsWord(strL,"curvy")    ? rslt.pose.push(str) :
        containsWord(strL,"arched")   ? rslt.pose.push(str) :
        containsWord(strL,"fucked")   ? rslt.pose.push(str) :
        containsWord(strL,"pussy")    ? rslt.pose.push(str) :
        containsWord(strL,"wide")     ? rslt.pose.push(str) :
        containsWord(strL,"spread")   ? rslt.pose.push(str) :
        containsWord(strL,"gap")      ? rslt.pose.push(str) :
        containsWord(strL,"closed")  ? rslt.pose.push(str) :
        containsWord(strL,"pose")  ? rslt.pose.push(str) :
        //
        containsWord(strL,"leaning")  ? rslt.pose.push(str) :
        containsWord(strL,"spreading")  ? rslt.pose.push(str) :
        containsWord(strL,"flashing")  ? rslt.pose.push(str) :
        containsWord(strL,"closing")  ? rslt.pose.push(str) :
        containsWord(strL,"riding")  ? rslt.pose.push(str) :
        containsWord(strL,"gaping")     ? rslt.pose.push(str) :
        containsWord(strL,"walking")  ? rslt.pose.push(str) :
        containsWord(strL,"looking")  ? rslt.pose.push(str) :
        containsWord(strL,"glasing")  ? rslt.pose.push(str) :
        containsWord(strL,"watching")  ? rslt.pose.push(str) :
        containsWord(strL,"breathing")  ? rslt.pose.push(str) :
        containsWord(strL,"screaming")  ? rslt.pose.push(str) :
        containsWord(strL,"crying")  ? rslt.pose.push(str) :
        containsWord(strL,"fingering") ? rslt.pose.push(str) :
        containsWord(strL,"drinking") ? rslt.pose.push(str) :
        containsWord(strL,"cumming")  ? rslt.pose.push(str) :
        containsWord(strL,"sunbathing")  ? rslt.pose.push(str) :
        containsWord(strL,"provocating")  ? rslt.pose.push(str) :
        containsWord(strL,"provocative")  ? rslt.pose.push(str) :
        //
        containsWord(strL,"all fours")  ? rslt.pose.push(str) :
        containsWord(strL,"on foours")  ? rslt.pose.push(str) :
        containsWord(strL,"on knees")  ? rslt.pose.push(str) :
        containsWord(strL,"one knee")  ? rslt.pose.push(str) :
        containsWord(strL,"squat")  ? rslt.pose.push(str) :
        //
        containsWord(strL,"doggy")  ? rslt.pose.push(str) :
        containsWord(strL,"missionary")  ? rslt.pose.push(str) :
        containsWord(strL,"cowgirl")  ? rslt.pose.push(str) :
        containsWord(strL,"hardcore")  ? rslt.pose.push(str) :
        containsWord(strL,"group sex")  ? rslt.pose.push(str) :
        //
        containsWord(strL,"fellatio")  ? rslt.pose.push(str) :
        containsWord(strL,"blowjob")  ? rslt.pose.push(str) :
        containsWord(strL,"cunnilingus")  ? rslt.pose.push(str) :
        //
        containsWord(strL,"grab")  ? rslt.pose.push(str) :
        containsWord(strL,"grabing")  ? rslt.pose.push(str) :

        containsWord(strL,"penetration")  ? rslt.pose.push(str) :
        containsWord(strL,"vaginal")  ? rslt.pose.push(str) :
        containsWord(strL,"anal")     ? rslt.pose.push(str) :
        containsWord(strL,"act")      ? rslt.pose.push(str) :
        containsWord(strL,"bondage")      ? rslt.pose.push(str) :
        containsWord(strL,"bdsm")      ? rslt.pose.push(str) :
        containsWord(strL,"gagged")      ? rslt.pose.push(str) :
        containsWord(strL,"bound") ? rslt.pose.push(str) :
        containsWord(strL,"shibari") ? rslt.pose.push(str) :
        containsWord(strL,"rope") ? rslt.pose.push(str) :
        //
        containsWord(strL,"bikini")   ? rslt.clothing.push(str) :
        containsWord(strL,"swimsuit")   ? rslt.clothing.push(str) :
        containsWord(strL,"top")      ? rslt.clothing.push(str) :
        containsWord(strL,"skirt")    ? rslt.clothing.push(str) :
        containsWord(strL,"shirt")    ? rslt.clothing.push(str) :
        containsWord(strL,"sweater")    ? rslt.clothing.push(str) :
        containsWord(strL,"polo")    ? rslt.clothing.push(str) :
        containsWord(strL,"pants")  ? rslt.clothing.push(str) :
        containsWord(strL,"panties")  ? rslt.clothing.push(str) :
        containsWord(strL,"pajama")  ? rslt.clothing.push(str) :
        containsWord(strL,"shorts")  ? rslt.clothing.push(str) :
        containsWord(strL,"strappy")  ? rslt.clothing.push(str) :
        containsWord(strL,"bra")      ? rslt.clothing.push(str) :
        containsWord(strL,"dress")    ? rslt.clothing.push(str) :
        containsWord(strL,"drape")    ? rslt.clothing.push(str) :
        containsWord(strL,"choker")   ? rslt.clothing.push(str) :
        containsWord(strL,"halter")   ? rslt.clothing.push(str) :
        containsWord(strL,"towel")    ? rslt.clothing.push(str) :
        containsWord(strL,"shoes")    ? rslt.clothing.push(str) :
        containsWord(strL,"high heels")    ? rslt.clothing.push(str) :
        containsWord(strL,"sneakers")    ? rslt.clothing.push(str) :
        containsWord(strL,"thongs")    ? rslt.clothing.push(str) :
        containsWord(strL,"barefoot")  ? rslt.clothing.push(str) :
        containsWord(strL,"socks")    ? rslt.clothing.push(str) :
        containsWord(strL,"stockings")    ? rslt.clothing.push(str) :
        containsWord(strL,"garter belt")  ? rslt.clothing.push(str) :
        containsWord(strL,"sleeves")  ? rslt.clothing.push(str) :
        containsWord(strL,"sleeveless")  ? rslt.clothing.push(str) :
        containsWord(strL,"leggins")  ? rslt.clothing.push(str) :
        containsWord(strL,"form-fitting")  ? rslt.clothing.push(str) :
        containsWord(strL,"romper")  ? rslt.clothing.push(str) :
        containsWord(strL,"playsuit")  ? rslt.clothing.push(str) :
        containsWord(strL,"blouse")  ? rslt.clothing.push(str) :
        containsWord(strL,"cap")  ? rslt.clothing.push(str) :
        containsWord(strL,"staps")  ? rslt.clothing.push(str) :
        containsWord(strL,"belts")  ? rslt.clothing.push(str) :
        containsWord(strL,"oufit")  ? rslt.clothing.push(str) :
        containsWord(strL,"cloth")  ? rslt.clothing.push(str) :
        containsWord(strL,"clothes")  ? rslt.clothing.push(str) :
        containsWord(strL,"clothing")  ? rslt.clothing.push(str) :
        containsWord(strL,"wearing")  ? rslt.clothing.push(str) :
        containsWord(strL,"fabric")  ? rslt.clothing.push(str) :
        containsWord(strL,"see-through")  ? rslt.clothing.push(str) :
        containsWord(strL,"hairband")  ? rslt.clothing.push(str) :
        containsWord(strL,"blindfold")  ? rslt.clothing.push(str) :
        //
        containsWord(strL,"flight attendant")  ? rslt.clothing.push(str) :
        containsWord(strL,"cheerleader")  ? rslt.clothing.push(str) :
        containsWord(strL,"cosplay")  ? rslt.clothing.push(str) :
        //
        containsWord(strL,"accessories")  ? rslt.clothing.push(str) :
        containsWord(strL,"glasses")  ? rslt.clothing.push(str) :
        containsWord(strL,"earrings") ? rslt.clothing.push(str) :
        containsWord(strL,"jewelry") ? rslt.clothing.push(str) :
        containsWord(strL,"bracelet") ? rslt.clothing.push(str) :
        containsWord(strL,"headphones") ? rslt.clothing.push(str) :
        containsWord(strL,"tape") ? rslt.clothing.push(str) :
        containsWord(strL,"anklet") ? rslt.clothing.push(str) :

        //
        containsWord(strL,"wall")     ? rslt.environment.push(str) :
        containsWord(strL,"walls")    ? rslt.environment.push(str) :
        containsWord(strL,"window")   ? rslt.environment.push(str) :
        containsWord(strL,"windows")  ? rslt.environment.push(str) :
        containsWord(strL,"porch")  ? rslt.environment.push(str) :
        containsWord(strL,"bedroom")  ? rslt.environment.push(str) :
        containsWord(strL,"bathroom") ? rslt.environment.push(str) :
        containsWord(strL,"shower") ? rslt.environment.push(str) :
        containsWord(strL,"toilet")   ? rslt.environment.push(str) :
        containsWord(strL,"lavatory")   ? rslt.environment.push(str) :
        containsWord(strL,"kitchen")   ? rslt.environment.push(str) :
        //
        containsWord(strL,"street")   ? rslt.environment.push(str) :
        containsWord(strL,"outdoors") ? rslt.environment.push(str) :
        containsWord(strL,"indoors")  ? rslt.environment.push(str) :
        containsWord(strL,"outdoor")  ? rslt.environment.push(str) :
        containsWord(strL,"indoor")   ? rslt.environment.push(str) :
        containsWord(strL,"cafe")     ? rslt.environment.push(str) :
        containsWord(strL,"library")  ? rslt.environment.push(str) :
        //
        containsWord(strL,"water")    ? rslt.environment.push(str) :
        containsWord(strL,"ocean")    ? rslt.environment.push(str) :
        containsWord(strL,"riverside") ? rslt.environment.push(str) :
        //
        containsWord(strL,"computer") ? rslt.environment.push(str) :
        containsWord(strL,"room")     ? rslt.environment.push(str) :
        containsWord(strL,"floor")     ? rslt.environment.push(str) :
        containsWord(strL,"ceiling")     ? rslt.environment.push(str) :
        containsWord(strL,"bed")      ? rslt.environment.push(str) :
        containsWord(strL,"lamp")     ? rslt.environment.push(str) :
        containsWord(strL,"lantern")  ? rslt.environment.push(str) :
        containsWord(strL,"lanterns") ? rslt.environment.push(str) :
        containsWord(strL,"rugs")     ? rslt.environment.push(str) :
        containsWord(strL,"bar")      ? rslt.environment.push(str) :
        containsWord(strL,"mirror")   ? rslt.environment.push(str) :
        containsWord(strL,"chair")    ? rslt.environment.push(str) :
        containsWord(strL,"chairs")   ? rslt.environment.push(str) :
        containsWord(strL,"stool")   ? rslt.environment.push(str) :
        containsWord(strL,"seat")     ? rslt.environment.push(str) :
        containsWord(strL,"futon")    ? rslt.environment.push(str) :
        containsWord(strL,"poster")    ? rslt.environment.push(str) :
        containsWord(strL,"beanbag")    ? rslt.environment.push(str) :
        containsWord(strL,"table")    ? rslt.environment.push(str) :
        containsWord(strL,"bench")    ? rslt.environment.push(str) :
        containsWord(strL,"desk")     ? rslt.environment.push(str) :
        containsWord(strL,"bin")      ? rslt.environment.push(str) :
        containsWord(strL,"fridge")   ? rslt.environment.push(str) :
        containsWord(strL,"piano")    ? rslt.environment.push(str) :
        containsWord(strL,"mug")     ? rslt.environment.push(str) :
        containsWord(strL,"shelf")     ? rslt.environment.push(str) :
        containsWord(strL,"book")     ? rslt.environment.push(str) :
        //
        containsWord(strL,"forest")   ? rslt.environment.push(str) :
        containsWord(strL,"garden")   ? rslt.environment.push(str) :
        containsWord(strL,"grove")   ? rslt.environment.push(str) :
        containsWord(strL,"sand")     ? rslt.environment.push(str) :
        containsWord(strL,"beach")    ? rslt.environment.push(str) :
        containsWord(strL,"tree")     ? rslt.environment.push(str) :
        containsWord(strL,"plant")    ? rslt.environment.push(str) :
        containsWord(strL,"plants")   ? rslt.environment.push(str) :
        //
        containsWord(strL,"party")    ? rslt.environment.push(str) :
        containsWord(strL,"background") ? rslt.environment.push(str) :
        containsWord(strL,"cabin") ? rslt.environment.push(str) :
        containsWord(strL,"house") ? rslt.environment.push(str) :
        containsWord(strL,"pool") ? rslt.environment.push(str) :
        containsWord(strL,"fireplace") ? rslt.environment.push(str) :
        //
        containsWord(strL,"shot")     ? rslt.composition.push(str) :
        containsWord(strL,"angle")    ? rslt.composition.push(str) :
        containsWord(strL,"frame")    ? rslt.composition.push(str) :
        containsWord(strL,"portrait") ? rslt.composition.push(str) :
        containsWord(strL,"close-up") ? rslt.composition.push(str) :
        containsWord(strL,"behind")   ? rslt.composition.push(str) :
        containsWord(strL,"below")   ? rslt.composition.push(str) :
        containsWord(strL,"above")   ? rslt.composition.push(str) :
        containsWord(strL,"quater")   ? rslt.composition.push(str) :
        containsWord(strL,"side")     ? rslt.composition.push(str) :
        containsWord(strL,"view")     ? rslt.composition.push(str) :
        containsWord(strL,"focus")    ? rslt.composition.push(str) :
        containsWord(strL,"visible")  ? rslt.composition.push(str) :
        containsWord(strL,"cropped")  ? rslt.composition.push(str) :
        containsWord(strL,"midriff")  ? rslt.composition.push(str) :
        containsWord(strL,"viewer")  ? rslt.composition.push(str) :
        containsWord(strL,"rule of thirds")  ? rslt.composition.push(str) :

        containsWord(strL,"film")  ? rslt.style.push(str) :
        containsWord(strL,"35mm")  ? rslt.style.push(str) :
        containsWord(strL,"depth of field")  ? rslt.style.push(str) :
        containsWord(strL,"bokeh")  ? rslt.style.push(str) :
        containsWord(strL,"grain")  ? rslt.style.push(str) :
        containsWord(strL,"focal")  ? rslt.style.push(str) :
        containsWord(strL,"aperture")  ? rslt.style.push(str) :
        containsWord(strL,"lens")  ? rslt.style.push(str) :
        containsWord(strL,"dynamic range")  ? rslt.style.push(str) :
        containsWord(strL,"colors")  ? rslt.style.push(str) :
        containsWord(strL,"colours")  ? rslt.style.push(str) :
        //
        containsWord(strL,"lighting") ? rslt.lighting.push(str) :
        containsWord(strL,"light")   ? rslt.lighting.push(str) :
        containsWord(strL,"night")   ? rslt.lighting.push(str) :
        containsWord(strL,"nighttime")   ? rslt.lighting.push(str) :
        containsWord(strL,"sunlight")  ? rslt.lighting.push(str) :
        containsWord(strL,"sunray")  ? rslt.lighting.push(str) :
        containsWord(strL,"sunset")  ? rslt.lighting.push(str) :
        containsWord(strL,"shadows") ? rslt.lighting.push(str) :
        containsWord(strL,"tones")  ? rslt.lighting.push(str) :
        containsWord(strL,"atmosphere") ? rslt.lighting.push(str) :
        containsWord(strL,"blushing") ? rslt.lighting.push(str) :
        containsWord(strL,"dusk")     ? rslt.lighting.push(str) :
        containsWord(strL,"glow")     ? rslt.lighting.push(str) :
        containsWord(strL,"reflections") ? rslt.lighting.push(str) :
        containsWord(strL,"flash")    ? rslt.boosters.push(str) :
        //
        containsWord(strL,"masterpiece")  ? rslt.boosters.push(str) :
        containsWord(strL,"cinematic")    ? rslt.boosters.push(str) :
        containsWord(strL,"professional") ? rslt.boosters.push(str) :
        containsWord(strL,"photo")        ? rslt.boosters.push(str) :
        containsWord(strL,"image")        ? rslt.boosters.push(str) :
        containsWord(strL,"quality")      ? rslt.boosters.push(str) :
        containsWord(strL,"highres")           ? rslt.boosters.push(str) :
        containsWord(strL,"4k")           ? rslt.boosters.push(str) :
        containsWord(strL,"8k")           ? rslt.boosters.push(str) :
        containsWord(strL,"photorealism") ? rslt.boosters.push(str) :
        containsWord(strL,"photorealistic") ? rslt.boosters.push(str) :
        containsWord(strL,"realism") ? rslt.boosters.push(str) :
        containsWord(strL,"realistic")    ? rslt.boosters.push(str) :
        containsWord(strL,"aesthetic")    ? rslt.boosters.push(str) :
        containsWord(strL,"detailed")    ? rslt.boosters.push(str) :
        containsWord(strL,"sharp")    ? rslt.boosters.push(str) :
        

        ((str !== "") && (str !=="BREAK")) ? rslt.others.push(str) : (true) ;
    }

    if (data.loras.length>0) {
        rslt = {...rslt, lora:data.loras}
    }

    if (rslt["source"].length===0) delete rslt["source"]
    if (rslt["style"].length===0) delete rslt["style"]
    if (rslt["others"].length===0) delete rslt["others"]

    return JSON.stringify(rslt, null, 2);
}

function formatPrompt(text) {

    if (!text.trim().startsWith("{")) {
        console.log("fmt.notajson",{text})
        return toJson(text);
    }
    try {
        const json = JSON.parse(text);
        return JSON.stringify(json, null, 2); // spacing level = 2
    } catch (e) {
        console.log("fmt.exception",{e})
        return text;
    }    
    return text
}