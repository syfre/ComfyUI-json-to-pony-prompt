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
    if ( ( (ch === ',') || (ch === ".") ) && (depth === 0) && (lora===0) ) {
        if (current !== 'BREAK')  {
            const term = current.trim()
            // if start by a connector then append to the last
            if ((term.startsWith("and ") || term.startsWith("with ")) && (result.strings.length>0)) {
                result.strings[result.strings.length-1] = result.strings[result.strings.length-1]+" "+term
            } else {
                result.strings.push(term);
            }
        } else {
            // BREAK is token bunch separator
            result.strings.push(current);
        }
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
    // .replace(/BREAK/g, "")
    let rslt = JSON.parse(jsonEmpty);
    const data = splitOutsideParens(text.replace(/[\n\r]+/g, ''));
    const str_array = data.strings;

    let lastSection = null; 
    for(var i = 0; i < str_array.length; i++) {
        //
        const str = str_array[i];
        if (str==="") continue;
        //
        if (str==="BREAK") {
            if (lastSection) lastSection.push(str);
            continue;
        }
        //
        const strL = str.toLowerCase().replace("_"," ");

        const section = 
        str.startsWith("score")  ? rslt.quality :
        str.startsWith("rating") ? rslt.quality :
        //
        str.startsWith("source") ? rslt.source :
        //
        containsWord(strL,"girl") ? rslt.subject :
        containsWord(strL,"girls")  ? rslt.subject :
        containsWord(strL,"1girl")    ? rslt.subject :
        containsWord(strL,"2girl")    ? rslt.subject :
        containsWord(strL,"2girls")    ? rslt.subject :
        containsWord(strL,"beautiful girl") ? rslt.subject :
        containsWord(strL,"1woman")    ? rslt.subject :
        containsWord(strL,"woman") ? rslt.subject :
        containsWord(strL,"1boy")     ? rslt.subject :
        containsWord(strL,"2boy")    ? rslt.subject :
        containsWord(strL,"2boys")    ? rslt.subject :
        containsWord(strL,"1man")     ? rslt.subject :
        containsWord(strL,"2man")     ? rslt.subject :
        containsWord(strL,"2men")     ? rslt.subject :
        containsWord(strL,"two boys")  ? rslt.subject :
        containsWord(strL,"couple")    ? rslt.subject :
        containsWord(strL,"gangbang")  ? rslt.subject :
        containsWord(strL,"gang bang")  ? rslt.subject :
        containsWord(strL,"old man")    ? rslt.subject :
        containsWord(strL,"middle age") ? rslt.subject :
        containsWord(strL,"elderly")    ? rslt.subject :
        containsWord(strL,"milf") ? rslt.subject :
        containsWord(strL,"mature") ? rslt.subject :
        containsWord(strL,"years")    ? rslt.subject :
        //
        containsWord(strL,"russian")  ? rslt.subject :
        containsWord(strL,"nordic") ? rslt.subject :
        containsWord(strL,"japanese") ? rslt.subject :
        containsWord(strL,"asian") ? rslt.subject :
        containsWord(strL,"african") ? rslt.subject :
        containsWord(strL,"european") ? rslt.subject :
        //
        containsWord(strL,"blonde")   ? rslt.description :
        containsWord(strL,"brunette") ? rslt.description :
        containsWord(strL,"model")    ? rslt.description :
        containsWord(strL,"old")      ? rslt.description :
        containsWord(strL,"age")      ? rslt.description :
        containsWord(strL,"perfect")      ? rslt.description :
        containsWord(strL,"beauty")      ? rslt.description :
        containsWord(strL,"youthful")      ? rslt.description :
        //
        containsWord(strL,"face")     ? rslt.description :
        containsWord(strL,"freckles") ? rslt.description :
        containsWord(strL,"dimples")  ? rslt.description :
        containsWord(strL,"skin")     ? rslt.description :
        containsWord(strL,"pores")     ? rslt.description :
        containsWord(strL,"makeup")   ? rslt.description :
        containsWord(strL,"tanlines")   ? rslt.description :
        containsWord(strL,"tattoo")   ? rslt.description :
        containsWord(strL,"tattoos")   ? rslt.description :
        //            
        containsWord(strL,"nude")   ? rslt.description :
        containsWord(strL,"undressing")   ? rslt.description :
        containsWord(strL,"undressed")   ? rslt.description :
        containsWord(strL,"shaved")   ? rslt.description :
        containsWord(strL,"unshaved")  ? rslt.description :
        containsWord(strL,"topless")      ? rslt.description :
        containsWord(strL,"wet")  ? rslt.description :
        containsWord(strL,"sweat")  ? rslt.description :
        containsWord(strL,"sweaty")  ? rslt.description :
        containsWord(strL,"tatooed")  ? rslt.description :
        //
        containsWord(strL,"hair")     ? rslt.description :
        containsWord(strL,"hairstyle")     ? rslt.description :
        containsWord(strL,"pigtails") ? rslt.description :
        containsWord(strL,"ponytail") ? rslt.description :
        containsWord(strL,"headwrap") ? rslt.description :
        containsWord(strL,"braids") ? rslt.description :
        containsWord(strL,"bangs") ? rslt.description :
        containsWord(strL,"cut")  ? rslt.description :
        containsWord(strL,"bolcut")  ? rslt.description :
        containsWord(strL,"haircut")  ? rslt.description :
        containsWord(strL,"curls")  ? rslt.description :
        containsWord(strL,"headdress")  ? rslt.description :
        //
        containsWord(strL,"slender")  ? rslt.description :
        containsWord(strL,"petite")     ? rslt.description :
        containsWord(strL,"slim")     ? rslt.description :
        containsWord(strL,"skinny")   ? rslt.description :
        containsWord(strL,"muscular")   ? rslt.description :
        containsWord(strL,"curves")   ? rslt.description :
        containsWord(strL,"fit")   ? rslt.description :
        containsWord(strL,"sporty")   ? rslt.description :
        containsWord(strL,"puffy")    ? rslt.description :
        containsWord(strL,"hairy")    ? rslt.description :
        //
        containsWord(strL,"head")    ? rslt.description :
        containsWord(strL,"eyes")     ? rslt.description :
        containsWord(strL,"eyebrows") ? rslt.description :
        containsWord(strL,"eyeshadow") ? rslt.description :
        containsWord(strL,"eyelashes") ? rslt.description :
        containsWord(strL,"eyeliner") ? rslt.description :
        containsWord(strL,"breast")   ? rslt.description :
        containsWord(strL,"breasts")  ? rslt.description :
        containsWord(strL,"boobs")  ? rslt.description :
        containsWord(strL,"areola")  ? rslt.description :
        containsWord(strL,"areolas")  ? rslt.description :
        containsWord(strL,"cleavage")  ? rslt.description :
        containsWord(strL,"tit")     ? rslt.description :
        containsWord(strL,"tits")     ? rslt.description :
        containsWord(strL,"nipple")  ? rslt.description :
        containsWord(strL,"nipples")  ? rslt.description :
        containsWord(strL,"piercings")  ? rslt.description :
        containsWord(strL,"pubic")    ? rslt.description :
        containsWord(strL,"mouth")    ? rslt.description :
        containsWord(strL,"cheeks")    ? rslt.description :
        containsWord(strL,"jawline")    ? rslt.description :
        containsWord(strL,"ears")     ? rslt.description :
        containsWord(strL,"lips")     ? rslt.description :
        containsWord(strL,"nose")     ? rslt.description :
        containsWord(strL,"tongue")   ? rslt.description :
        containsWord(strL,"belly")    ? rslt.description :
        containsWord(strL,"chest")    ? rslt.description :
        containsWord(strL,"waist")    ? rslt.description :
        containsWord(strL,"shoulders")  ? rslt.description :
        containsWord(strL,"arms")     ? rslt.description :
        containsWord(strL,"armpits")  ? rslt.description :
        containsWord(strL,"hands")  ? rslt.description :
        containsWord(strL,"navel")  ? rslt.description :
        containsWord(strL,"hip")      ? rslt.description :
        containsWord(strL,"hips")      ? rslt.description :
        containsWord(strL,"thighs")   ? rslt.description :
        containsWord(strL,"ass")      ? rslt.description :
        containsWord(strL,"roundass")      ? rslt.description :
        containsWord(strL,"buttcheeks")      ? rslt.description :
        containsWord(strL,"buttocks")      ? rslt.description :
        containsWord(strL,"butt")      ? rslt.description :
        containsWord(strL,"bun")      ? rslt.description :
        containsWord(strL,"legs")      ? rslt.description :
        containsWord(strL,"feet")     ? rslt.description :
        containsWord(strL,"toes")     ? rslt.description :
        //
        containsWord(strL,"pussy")    ? rslt.description :
        containsWord(strL,"vagina")   ? rslt.description :
        containsWord(strL,"labia")    ? rslt.description :
        containsWord(strL,"vulvar")    ? rslt.description :
        containsWord(strL,"crotch")    ? rslt.description :
        containsWord(strL,"cameltoe")    ? rslt.description :
        containsWord(strL,"toe")    ? rslt.description :
        containsWord(strL,"anus")    ? rslt.description :
        containsWord(strL,"dick")     ? rslt.description :
        containsWord(strL,"cock")     ? rslt.description :
        containsWord(strL,"penis")     ? rslt.description :
        containsWord(strL,"balls")     ? rslt.description :
        containsWord(strL,"testicles")  ? rslt.description :
        //
        containsWord(strL,"girly")     ? rslt.description :
        containsWord(strL,"attractive")  ? rslt.description :
        containsWord(strL,"feminine")  ? rslt.description :
        containsWord(strL,"amateur")     ? rslt.description :
        containsWord(strL,"lilycat")    ? rslt.description :
        containsWord(strL,"look")     ? rslt.description :
        containsWord(strL,"seductive")  ? rslt.description :
        containsWord(strL,"adorable") ? rslt.description :
        containsWord(strL,"sensual") ? rslt.description :
        containsWord(strL,"bimbo")  ? rslt.description :
        containsWord(strL,"happy")    ? rslt.description :
        containsWord(strL,"smile")    ? rslt.description :
        containsWord(strL,"smiling")  ? rslt.description :
        containsWord(strL,"smirk")    ? rslt.description :
        containsWord(strL,"blush")    ? rslt.description :
        containsWord(strL,"flirty") ? rslt.description :
        containsWord(strL,"expression") ? rslt.description :
        containsWord(strL,"expressionless")    ? rslt.description :
        containsWord(strL,"expressiveh")  ? rslt.description :
        containsWord(strL,"exhausted")  ? rslt.description :
        containsWord(strL,"confident")  ? rslt.description :
        containsWord(strL,"embarrassed")  ? rslt.description :
        containsWord(strL,"scared")  ? rslt.description :
        containsWord(strL,"despair")  ? rslt.description :
        containsWord(strL,"surprised")  ? rslt.description :
        containsWord(strL,"curious")  ? rslt.description :
        containsWord(strL,"horny")  ? rslt.description :
        containsWord(strL,"shy")  ? rslt.description :
        containsWord(strL,"dancer")  ? rslt.description :
        containsWord(strL,"pregnant")  ? rslt.description :
        //
        containsWord(strL,"creampie")  ? rslt.description :
        containsWord(strL,"cum")  ? rslt.description :
        containsWord(strL,"saliva")  ? rslt.description :
        //
        containsWord(strL,"up")       ? rslt.pose :
        containsWord(strL,"down")     ? rslt.pose :
        containsWord(strL,"standing") ? rslt.pose :
        containsWord(strL,"lying")    ? rslt.pose :
        containsWord(strL,"sits")    ? rslt.pose :
        containsWord(strL,"sitting")    ? rslt.pose :
        containsWord(strL,"holding")  ? rslt.pose :
        containsWord(strL,"squatting") ? rslt.pose :
        containsWord(strL,"spitting") ? rslt.pose :
        containsWord(strL,"kneeling") ? rslt.pose :
        containsWord(strL,"hand")     ? rslt.pose :
        containsWord(strL,"curvy")    ? rslt.pose :
        containsWord(strL,"arched")   ? rslt.pose :
        containsWord(strL,"fucked")   ? rslt.pose :
        containsWord(strL,"pussy")    ? rslt.pose :
        containsWord(strL,"wide")     ? rslt.pose :
        containsWord(strL,"spread")   ? rslt.pose :
        containsWord(strL,"gap")      ? rslt.pose :
        containsWord(strL,"closed")  ? rslt.pose :
        containsWord(strL,"pose")  ? rslt.pose :
        //
        containsWord(strL,"leaning")  ? rslt.pose :
        containsWord(strL,"spreading")  ? rslt.pose :
        containsWord(strL,"flashing")  ? rslt.pose :
        containsWord(strL,"closing")  ? rslt.pose :
        containsWord(strL,"riding")  ? rslt.pose :
        containsWord(strL,"gaping")     ? rslt.pose :
        containsWord(strL,"walking")  ? rslt.pose :
        containsWord(strL,"looking")  ? rslt.pose :
        containsWord(strL,"glazing")  ? rslt.pose :
        containsWord(strL,"watching")  ? rslt.pose :
        containsWord(strL,"breathing")  ? rslt.pose :
        containsWord(strL,"screaming")  ? rslt.pose :
        containsWord(strL,"crying")  ? rslt.pose :
        containsWord(strL,"fingering") ? rslt.pose :
        containsWord(strL,"drinking") ? rslt.pose :
        containsWord(strL,"cumming")  ? rslt.pose :
        containsWord(strL,"sunbathing")  ? rslt.pose :
        containsWord(strL,"provocating")  ? rslt.pose :
        containsWord(strL,"provocative")  ? rslt.pose :
        //
        containsWord(strL,"all fours")  ? rslt.pose :
        containsWord(strL,"on foours")  ? rslt.pose :
        containsWord(strL,"on back")  ? rslt.pose :
        containsWord(strL,"on knees")  ? rslt.pose :
        containsWord(strL,"one knee")  ? rslt.pose :
        containsWord(strL,"squat")  ? rslt.pose :
        //
        containsWord(strL,"doggy")  ? rslt.pose :
        containsWord(strL,"missionary")  ? rslt.pose :
        containsWord(strL,"cowgirl")  ? rslt.pose :
        containsWord(strL,"hardcore")  ? rslt.pose :
        containsWord(strL,"group sex")  ? rslt.pose :
        //
        containsWord(strL,"fellatio")  ? rslt.pose :
        containsWord(strL,"blowjob")  ? rslt.pose :
        containsWord(strL,"deep thraot")  ? rslt.pose :
        containsWord(strL,"deepthroat")  ? rslt.pose :
        containsWord(strL,"cunnilingus")  ? rslt.pose :
        //
        containsWord(strL,"grab")  ? rslt.pose :
        containsWord(strL,"grabing")  ? rslt.pose :

        containsWord(strL,"penetration")  ? rslt.pose :
        containsWord(strL,"vaginal")  ? rslt.pose :
        containsWord(strL,"anal")     ? rslt.pose :
        containsWord(strL,"act")      ? rslt.pose :
        containsWord(strL,"bondage")      ? rslt.pose :
        containsWord(strL,"bdsm")      ? rslt.pose :
        containsWord(strL,"gagged")      ? rslt.pose :
        containsWord(strL,"bound") ? rslt.pose :
        containsWord(strL,"shibari") ? rslt.pose :
        containsWord(strL,"rope") ? rslt.pose :
        //
        containsWord(strL,"bikini")   ? rslt.clothing :
        containsWord(strL,"swimsuit")   ? rslt.clothing :
        containsWord(strL,"top")      ? rslt.clothing :
        containsWord(strL,"skirt")    ? rslt.clothing :
        containsWord(strL,"shirt")    ? rslt.clothing :
        containsWord(strL,"sweater")    ? rslt.clothing :
        containsWord(strL,"polo")    ? rslt.clothing :
        containsWord(strL,"pants")  ? rslt.clothing :
        containsWord(strL,"panties")  ? rslt.clothing :
        containsWord(strL,"pajama")  ? rslt.clothing :
        containsWord(strL,"nightgown")  ? rslt.clothing :
        containsWord(strL,"shorts")  ? rslt.clothing :
        containsWord(strL,"strappy")  ? rslt.clothing :
        containsWord(strL,"bra")      ? rslt.clothing :
        containsWord(strL,"dress")    ? rslt.clothing :
        containsWord(strL,"robe")    ? rslt.clothing :
        containsWord(strL,"drape")    ? rslt.clothing :
        containsWord(strL,"choker")   ? rslt.clothing :
        containsWord(strL,"halter")   ? rslt.clothing :
        containsWord(strL,"towel")    ? rslt.clothing :
        containsWord(strL,"shoes")    ? rslt.clothing :
        containsWord(strL,"high heels")    ? rslt.clothing :
        containsWord(strL,"sneakers")    ? rslt.clothing :
        containsWord(strL,"thongs")    ? rslt.clothing :
        containsWord(strL,"barefoot")  ? rslt.clothing :
        containsWord(strL,"socks")    ? rslt.clothing :
        containsWord(strL,"stockings")    ? rslt.clothing :
        containsWord(strL,"socks")    ? rslt.clothing :
        containsWord(strL,"pantyhose")    ? rslt.clothing :
        containsWord(strL,"underwear")  ? rslt.clothing :
        containsWord(strL,"lingerie")  ? rslt.clothing :
        containsWord(strL,"sleeves")  ? rslt.clothing :
        containsWord(strL,"sleeveless")  ? rslt.clothing :
        containsWord(strL,"leggins")  ? rslt.clothing :
        containsWord(strL,"form-fitting")  ? rslt.clothing :
        containsWord(strL,"romper")  ? rslt.clothing :
        containsWord(strL,"playsuit")  ? rslt.clothing :
        containsWord(strL,"blouse")  ? rslt.clothing :
        containsWord(strL,"cap")  ? rslt.clothing :
        containsWord(strL,"staps")  ? rslt.clothing :
        containsWord(strL,"belts")  ? rslt.clothing :
        containsWord(strL,"ribbon")  ? rslt.clothing :
        containsWord(strL,"oufit")  ? rslt.clothing :
        containsWord(strL,"cloth")  ? rslt.clothing :
        containsWord(strL,"clothes")  ? rslt.clothing :
        containsWord(strL,"clothing")  ? rslt.clothing :
        containsWord(strL,"wearing")  ? rslt.clothing :
        containsWord(strL,"fabric")  ? rslt.clothing :
        containsWord(strL,"see-through")  ? rslt.clothing :
        containsWord(strL,"hairband")  ? rslt.clothing :
        containsWord(strL,"blindfold")  ? rslt.clothing :
        //
        containsWord(strL,"flight attendant")  ? rslt.clothing :
        containsWord(strL,"cheerleader")  ? rslt.clothing :
        containsWord(strL,"cosplay")  ? rslt.clothing :
        //
        containsWord(strL,"accessories")  ? rslt.clothing :
        containsWord(strL,"glasses")  ? rslt.clothing :
        containsWord(strL,"earrings") ? rslt.clothing :
        containsWord(strL,"jewelry") ? rslt.clothing :
        containsWord(strL,"bracelet") ? rslt.clothing :
        containsWord(strL,"headphones") ? rslt.clothing :
        containsWord(strL,"tape") ? rslt.clothing :
        containsWord(strL,"anklet") ? rslt.clothing :
        containsWord(strL,"dildo") ? rslt.clothing :
        

        //
        containsWord(strL,"wall")     ? rslt.environment :
        containsWord(strL,"walls")    ? rslt.environment :
        containsWord(strL,"window")   ? rslt.environment :
        containsWord(strL,"windows")  ? rslt.environment :
        containsWord(strL,"porch")  ? rslt.environment :
        containsWord(strL,"bedroom")  ? rslt.environment :
        containsWord(strL,"bathroom") ? rslt.environment :
        containsWord(strL,"shower") ? rslt.environment :
        containsWord(strL,"toilet")   ? rslt.environment :
        containsWord(strL,"lavatory")   ? rslt.environment :
        containsWord(strL,"kitchen")   ? rslt.environment :
        //
        containsWord(strL,"street")   ? rslt.environment :
        containsWord(strL,"outdoors") ? rslt.environment :
        containsWord(strL,"indoors")  ? rslt.environment :
        containsWord(strL,"outdoor")  ? rslt.environment :
        containsWord(strL,"indoor")   ? rslt.environment :
        containsWord(strL,"cafe")     ? rslt.environment :
        containsWord(strL,"library")  ? rslt.environment :
        //
        containsWord(strL,"water")    ? rslt.environment :
        containsWord(strL,"ocean")    ? rslt.environment :
        containsWord(strL,"riverside") ? rslt.environment :
        //
        containsWord(strL,"computer") ? rslt.environment :
        containsWord(strL,"room")     ? rslt.environment :
        containsWord(strL,"floor")     ? rslt.environment :
        containsWord(strL,"ceiling")     ? rslt.environment :
        containsWord(strL,"bed")      ? rslt.environment :
        containsWord(strL,"pillow")      ? rslt.environment :
        containsWord(strL,"lamp")     ? rslt.environment :
        containsWord(strL,"lantern")  ? rslt.environment :
        containsWord(strL,"lanterns") ? rslt.environment :
        containsWord(strL,"rugs")     ? rslt.environment :
        containsWord(strL,"bar")      ? rslt.environment :
        containsWord(strL,"mirror")   ? rslt.environment :
        containsWord(strL,"chair")    ? rslt.environment :
        containsWord(strL,"chairs")   ? rslt.environment :
        containsWord(strL,"stool")   ? rslt.environment :
        containsWord(strL,"seat")     ? rslt.environment :
        containsWord(strL,"futon")    ? rslt.environment :
        containsWord(strL,"poster")    ? rslt.environment :
        containsWord(strL,"beanbag")    ? rslt.environment :
        containsWord(strL,"table")    ? rslt.environment :
        containsWord(strL,"bench")    ? rslt.environment :
        containsWord(strL,"desk")     ? rslt.environment :
        containsWord(strL,"bin")      ? rslt.environment :
        containsWord(strL,"fridge")   ? rslt.environment :
        containsWord(strL,"piano")    ? rslt.environment :
        containsWord(strL,"mug")     ? rslt.environment :
        containsWord(strL,"shelf")     ? rslt.environment :
        containsWord(strL,"book")     ? rslt.environment :
        //
        containsWord(strL,"forest")   ? rslt.environment :
        containsWord(strL,"garden")   ? rslt.environment :
        containsWord(strL,"grove")   ? rslt.environment :
        containsWord(strL,"sand")     ? rslt.environment :
        containsWord(strL,"beach")    ? rslt.environment :
        containsWord(strL,"tree")     ? rslt.environment :
        containsWord(strL,"plant")    ? rslt.environment :
        containsWord(strL,"plants")   ? rslt.environment :
        //
        containsWord(strL,"party")    ? rslt.environment :
        containsWord(strL,"background") ? rslt.environment :
        containsWord(strL,"cabin") ? rslt.environment :
        containsWord(strL,"house") ? rslt.environment :
        containsWord(strL,"pool") ? rslt.environment :
        containsWord(strL,"fireplace") ? rslt.environment :
        //
        containsWord(strL,"composition")  ? rslt.composition :
        containsWord(strL,"ratio")  ? rslt.composition :
        containsWord(strL,"camera")  ? rslt.composition :
        containsWord(strL,"shot")     ? rslt.composition :
        containsWord(strL,"angle")    ? rslt.composition :
        containsWord(strL,"frame")    ? rslt.composition :
        containsWord(strL,"portrait") ? rslt.composition :
        containsWord(strL,"close-up") ? rslt.composition :
        containsWord(strL,"behind")   ? rslt.composition :
        containsWord(strL,"below")   ? rslt.composition :
        containsWord(strL,"above")   ? rslt.composition :
        containsWord(strL,"quater")   ? rslt.composition :
        containsWord(strL,"side")     ? rslt.composition :
        containsWord(strL,"view")     ? rslt.composition :
        containsWord(strL,"focus")    ? rslt.composition :
        containsWord(strL,"visible")  ? rslt.composition :
        containsWord(strL,"cropped")  ? rslt.composition :
        containsWord(strL,"midriff")  ? rslt.composition :
        containsWord(strL,"viewer")  ? rslt.composition :
        containsWord(strL,"rule of thirds")  ? rslt.composition :

        containsWord(strL,"film")  ? rslt.style :
        containsWord(strL,"35mm")  ? rslt.style :
        containsWord(strL,"depth of field")  ? rslt.style :
        containsWord(strL,"bokeh")  ? rslt.style :
        containsWord(strL,"grain")  ? rslt.style :
        containsWord(strL,"focal")  ? rslt.style :
        containsWord(strL,"aperture")  ? rslt.style :
        containsWord(strL,"lens")  ? rslt.style :
        containsWord(strL,"dynamic range")  ? rslt.style :
        containsWord(strL,"colors")  ? rslt.style :
        containsWord(strL,"colours")  ? rslt.style :
        containsWord(strL,"artistic")  ? rslt.style :
        containsWord(strL,"impressionistic")  ? rslt.style :
        //
        containsWord(strL,"lighting") ? rslt.lighting :
        containsWord(strL,"light")   ? rslt.lighting :
        containsWord(strL,"night")   ? rslt.lighting :
        containsWord(strL,"nighttime")   ? rslt.lighting :
        containsWord(strL,"sunlight")  ? rslt.lighting :
        containsWord(strL,"daylight")  ? rslt.lighting :
        containsWord(strL,"sunray")  ? rslt.lighting :
        containsWord(strL,"sunset")  ? rslt.lighting :
        containsWord(strL,"shadows") ? rslt.lighting :
        containsWord(strL,"tones")  ? rslt.lighting :
        containsWord(strL,"atmosphere") ? rslt.lighting :
        containsWord(strL,"blushing") ? rslt.lighting :
        containsWord(strL,"dusk")     ? rslt.lighting :
        containsWord(strL,"glow")     ? rslt.lighting :
        containsWord(strL,"reflections") ? rslt.lighting :
        containsWord(strL,"flash")    ? rslt.boosters :
        //
        containsWord(strL,"masterpiece")  ? rslt.boosters :
        containsWord(strL,"cinematic")    ? rslt.boosters :
        containsWord(strL,"professional") ? rslt.boosters :
        containsWord(strL,"photo")        ? rslt.boosters :
        containsWord(strL,"image")        ? rslt.boosters :
        containsWord(strL,"quality")      ? rslt.boosters :
        containsWord(strL,"highres")           ? rslt.boosters :
        containsWord(strL,"4k")           ? rslt.boosters :
        containsWord(strL,"8k")           ? rslt.boosters :
        containsWord(strL,"photorealism") ? rslt.boosters :
        containsWord(strL,"photorealistic") ? rslt.boosters :
        containsWord(strL,"realism") ? rslt.boosters :
        containsWord(strL,"realistic")    ? rslt.boosters :
        containsWord(strL,"aesthetic")    ? rslt.boosters :
        containsWord(strL,"detailed")    ? rslt.boosters :
        containsWord(strL,"sharp")    ? rslt.boosters :
        (str !== "")  ? rslt.others : null ;

        if (section) section.push(str)
        lastSection = section;
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