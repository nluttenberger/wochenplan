'use strict';
// --------- shared variables
let gitPath;
let gitSHA;
let gitName;
let planXML;
const weekday = ['mon','tue','wdn','thu','fri','sat','sun'];
const apiKey = localStorage.getItem('apiKey');
const hdrs = {
  'Accept': 'application/vnd.github.v3+json',
  'Authorization': apiKey
}
let action;
let dragLink;
let weekNo;
let weekStart, weekStartISO;
let weekEnd, weekEndISO;
// --------- add event listener on document load
document.addEventListener ('DOMContentLoaded', event => {
// ---------------------------------------------
  for (let dO of document.getElementsByClassName('dragObj')) {
    dO.addEventListener('dragstart', event => {
      dragLink = event.target;
      let id = Math.random().toString(36).substr(2, 9);
      dragLink.setAttribute('id',id);
      event.dataTransfer.setData("text/plain", event.target)
    });
  };
  for (let dO of document.getElementsByClassName('targetDiv')) {
    dO.addEventListener('dragstart', event => {
      dragLink = event.target;
      let id = Math.random().toString(36).substr(2, 9);
      dragLink.setAttribute('id',id);
      event.dataTransfer.setData("text/plain", event.target)
    });
  };
  for (let td of document.getElementsByClassName('targetDiv')) {
    td.addEventListener('dragover', event => {
      event.preventDefault();
      event.target.classList.add("over-me");
    });
  };
  for (let td of document.getElementsByClassName('targetDiv')) {
    td.addEventListener('dragleave', event => {
      event.target.classList.add("static");
      event.target.classList.remove("over-me");
    });
  };

  // drop event
  // target may be:
  // 1 - empty div
  // 2 - filled div
  // 3 - rcp link
  // on drop into 1:
  // toggle "empty div" to "filled div"
  // if "fresh" link
  // -> clone link, switch cloned link from "fresh" to "replace"
  // on drop into 2:
  // remove link contained in div
  // if "fresh" link
  // -> clone link, switch cloned link from "fresh" to "replace"
  // on drop into 3:
  // remove link

  for (let td of document.getElementsByClassName('targetDiv')) {
    td.addEventListener('drop', event => {
      switch (true) {
        case event.target.classList.contains('empty'): {
          console.log ('1')
          event.target.classList.replace('empty', 'filled');
          let linkClone = $(dragLink).clone(true);
          linkClone.classList.add('replace');
          linkClone.appendTo(event.target);
          break;
        }
        case event.target.classList.contains('filled'): {
          console.log ('2');
          event.target.firstChild.remove();
          if (dragLink.classList.contains('replace')) {
            dragLink.remove();
          }
          let linkClone = $(dragLink).clone(true);
          linkClone.classList.add('replace');
          linkClone.appendTo(event.target);
          break;
        }
        case event.target.classList.contains('replace'): {
          console.log ('3')
          let par = event.target.parentElement;
          event.target.remove();
          let linkClone = $(dragLink).clone(true);
          linkClone.addClass('replace');
          linkClone.appendTo(par);
          if (dragLink.classList.contains ('replace')) {
            dragLink.remove();
          }
          break;
        }
        default: {
          event.target.classList.remove('over-me');
          if (event.target.children.length > 0) {
            event.target.firstChild.remove();
            console.log ('4.1')
          }
          if (!(dragLink.classList.contains('replace'))) {
            let linkClone = $(dragLink).clone(true);
            linkClone.addClass('replace');
            linkClone.appendTo(event.target);
            console.log ('4.2')
          } else {
            event.target.append(dragLink);
            console.log ('4.3')
          }
        }
      }
    })
  }

  document.getElementById("weekBtn").addEventListener("click", event => {
    preparePlan();
    weekNo = document.getElementById("week").value;
    let DateTime = luxon.DateTime;
    let yearNumber = 2022;
    let dt = DateTime.fromObject({
      weekYear: yearNumber,
      weekNumber: weekNo
    });
    let dateFromStr = dt.startOf('week');
    weekStartISO = dateFromStr.toISODate();
    weekStart = dateFromStr.toFormat('dd.MM.');
    let dateToStr = dt.endOf('week');
    weekEndISO = dateToStr.toISODate();
    weekEnd = dateToStr.toFormat('dd.MM.yyyy');
    let lE = document.getElementById("kwSet").lastChild;
    lE?.remove();
    let st = document.createElement('p');
    st.setAttribute('class', 'week');
    let txt = document.createTextNode(`${weekStart} – ${weekEnd}`);
    st.append(txt);
    document.getElementById("kwSet").append (st);
  });
  document.getElementById("saveBtn").addEventListener("click", savePlan);
});
// --------- functions
function b64_to_utf8(str) {
  return decodeURIComponent(escape(window.atob(str)));
}
function utf8_to_b64(str) {
  return window.btoa(unescape(encodeURIComponent(str)));
}

// --------------------------------------
function preparePlan () {
// --------------------------------------
  // --- check if plan exists
  // --- get access to plans_xml directory
  let url_str = `https://api.github.com/repos/nluttenberger/wochenplan/contents`;
  fetch(url_str,{headers: hdrs})
    .then(resp => {
      return resp.json();
    })
    .then(data => {
      let ix = data.indexOf(data.filter(function(item) {
        return item.path === "plans_xml"
      })[0])
      // --- read plans_xml contents
      let sha = data[ix].sha;
      url_str = `https://api.github.com/repos/nluttenberger/wochenplan/git/trees/${sha}?recursive=true`;
      fetch(url_str,{headers: hdrs})
        .then (resp =>  {
          console.log('Wochenplanindex eingelesen: ', resp.status, resp.statusText);
          return resp.json()
        })
        .then(data => {
          // --- check if current plan is already available
          let tree = data.tree;
          weekNo = weekNo.toString().padStart(2, "0");
          let ix = tree.findIndex (element => element.path === `jahr_2022/kw${weekNo}.xml`);
          if (ix != -1) {
            action = 'update';
            let url_str = `https://api.github.com/repos/nluttenberger/wochenplan/contents/plans_xml/jahr_2022/kw${weekNo}.xml`;
            fetch (url_str,{headers: hdrs})
              .then (resp => resp.json())
              .then (data => {
                planXML = b64_to_utf8(data.content);
                gitName = data.name;
                gitPath = data.path;
                gitSHA = data.sha;
                // --- fill form from available plan data
                planXML = b64_to_utf8(data.content);
                let parser = new DOMParser();
                let xmlDoc = parser.parseFromString(planXML, "text/xml");
                fillPlan (xmlDoc);
              })
              .catch ((error) => {
                console.log('Error while reading recipe xml data:', error);
              })
          } else {
            action = 'save';
            console.log ('Selected plan not yet available in wochenplan repo.');
          }
        })
        .catch ((error) => {
          console.log('Error while reading directory listings:', error);
        })
    })
    .catch ((error) => {
      console.log('Error while reading collection sha:', error);
    })
}
// --------------------------------------
function fillPlan (xmlDoc) {
// --------------------------------------
  function filler (idx) {
    let aEl = document.createElement('a');
    let meal = xmlDoc.getElementsByTagName(`wp:${weekday[idx]}Meal`)[0];
    let mealName = meal.getElementsByTagName('wp:mealName')[0].textContent;
    let tEl = document.createTextNode(mealName)
    aEl.append(tEl);
    let mealRcpLinkHTML = meal.getElementsByTagName('wp:rcpLinkHTML')[0].textContent ?? '';
    aEl.setAttribute('href',mealRcpLinkHTML);
    let mealRcpLinkXML = meal.getElementsByTagName('wp:rcpLinkXML')[0].textContent ?? '';
    aEl.setAttribute('data-xmllink',mealRcpLinkXML);
    aEl.setAttribute('draggable','true');
    aEl.setAttribute('target', '_blank');
    aEl.classList.add ('dragObj', 'replace', 'rcpList');
    let target = document.getElementById( `${weekday[idx]}Target`).firstChild;
    target?.remove();
    document.getElementById( `${weekday[idx]}Target`).append(aEl);
  }
  weekday.forEach ((val,idx) => {
    filler(idx);
  });
};
// --------------------------------------
function savePlan () {
// --------------------------------------
  if (weekNo === undefined) {
    alert("Bitte eine Kalenderwoche angeben!");
    return;
  }
  function createPlan() {
    function week (idx) {
      let meal;
      let mealNameNode;
      let rcpLinkHTMLNode;
      let rcpLinkXMLNode;
      meal = xmlDoc.createElement(`wp:${weekday[idx]}Meal`);
      mealNameNode = xmlDoc.createElement("wp:mealName");
      rcpLinkHTMLNode = xmlDoc.createElement("wp:rcpLinkHTML");
      rcpLinkXMLNode = xmlDoc.createElement("wp:rcpLinkXML");
      $(mealNameNode).append (document.createTextNode($(`#${weekday[idx]}Target a`).text()));
      $(rcpLinkHTMLNode).append (document.createTextNode($(`#${weekday[idx]}Target a`).attr("href"))??'');
      $(rcpLinkXMLNode).append (document.createTextNode($(`#${weekday[idx]}Target a`).attr("data-xmllink"))??'');


      if ($(`#${weekday[idx]}Target a`).attr("data-xmllink") === undefined) {
        console.log ('blub')
      } else {
        console.log ($(`#${weekday[idx]}Target a`).attr("data-xmllink"));
      }
      //let xx = ($(`#${weekday[idx]}Target a`).attr("data-xmllink")) ?? "blub";
      //console.log (xx);

      $(meal).append(mealNameNode).append(rcpLinkHTMLNode).append(rcpLinkXMLNode);
      $(docEl).append(meal);
    }
    let rootEl = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<!DOCTYPE stylesheet SYSTEM "file:///C:/Users/nlutt/Documents/Websites/tools/entities.dtd">\n' +
        '<wp:wochenplan \n' +
        '    xmlns:wp="http://fruschtique.de/ns/wochenplan" \n' +
        '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" \n' +
        '    xsi:schemaLocation="http://fruschtique.de/ns/wochenplan ../../../wochenplan.xsd" \n' +
        //'    rcpID = "' + rcpID + '"
        '>\n' +
        '</wp:wochenplan>';
    let parser = new DOMParser();
    let xmlDoc = parser.parseFromString(rootEl, "text/xml");
    let docEl = xmlDoc.documentElement;
    docEl.setAttribute('wp:weekNo',weekNo);
    docEl.setAttribute('wp:startDate',weekStartISO);
    docEl.setAttribute('wp:endDate',weekEndISO);
    weekday.forEach ((val,idx) => {
      week(idx);
    });
    //--- serialize form input to XML --------------------------------------------------
    let xmlText = new XMLSerializer().serializeToString(xmlDoc);
    // convert updated recipe to base64 and return -----------------------------------
    return (utf8_to_b64(xmlText));
  }
  function updatePlan() {
    let plan = createPlan ();
    //build update object ---
    let update = {
      'message': 'update',
      'content': plan,
      'sha': gitSHA
    }
    // upload and commit ---
    let urlStr = `https://api.github.com/repos/nluttenberger/wochenplan/contents/${gitPath}`;
    fetch (urlStr,{
      method: 'PUT',
      body: JSON.stringify(update),
      headers: hdrs
    })
      .then (resp => {
        console.log('Update: ', resp.status, resp.statusText);
        if (resp.status === 200) {
          alert ('Plan aktualisiert!')
          location.reload(true);
        }
        return resp.json()
      })
      .then (data => {
        console.log (data.commit);
      })
      .catch((error) => {
        console.error('Error while saving plan: ', error);
      })
  }
  function newPlan () {
    let plan = createPlan ();
    //build update object ---
    let update = {
      'message': 'just created',
      'content': plan
    }
    // upload and commit ---
    let urlStr = `https://api.github.com/repos/nluttenberger/wochenplan/contents/plans_xml/jahr_2022/kw${weekNo}.xml`;
    fetch (urlStr,{
      method: 'PUT',
      body: JSON.stringify(update),
      headers: hdrs
    })
      .then (resp => {
        if (resp.status === 201) {
          alert ('Plan angelegt!');
        }
        return resp.json()
      })
      .then (data => {
        gitName = data.name;
        gitPath = data.path;
        gitSHA = data.sha;
      })
      .catch((error) => {
        console.error('Error while saving recipe: ', error);
      })
  }
  if (action === 'update') {
    updatePlan();
  } else {
    newPlan();
  }
};
