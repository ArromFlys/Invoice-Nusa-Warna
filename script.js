"use strict";

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const STORAGE_KEY = "nusawarna_invoice_v2";
const LOGO_KEY = "nusawarna_invoice_logo";

const DEFAULT_DATA = {
    invoiceNo: "#INV-2026-001",
    status: "pending",
    invoiceDate: "2026-10-15",
    dueDate: "2026-10-15",
    currency: "IDR",
    taxPercent: 0,
    fromName: "CV. NUSAWARNA KREASI",
    fromDetail: "Jl. Pejanggik No.40, Pancor\nLombok Timur, 83611\nIndonesia",
    toName: "Matori",
    toDetail: "Jl. Lintas Laskar, Masbagik\nLombok Timur, 40262\nIndonesia",
    notes: "Pembayaran dapat dilakukan melalui transfer bank ke rekening BCA 7257252513 a.n. KIPLIANI.",
    items: [
        {name:"Kaos", desc:"S 1", qty:1, price:150000, discount:0}
    ]
};

let D = loadData();

function getTodayISO(){
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function syncInvoiceDate(){
  const today = getTodayISO();
  if (D.invoiceDate !== today) {
    D.invoiceDate = today;
    saveData();
  }
}

function $(id){ return document.getElementById(id); }

function loadData(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return structuredClone(DEFAULT_DATA);
    return normalizeData({...DEFAULT_DATA, ...saved, items:saved.items || DEFAULT_DATA.items});
  } catch {
    return structuredClone(DEFAULT_DATA);
  }
}

function normalizeData(data){
  data.taxPercent = clampNumber(data.taxPercent, 0, 100, 0);
  data.items = Array.isArray(data.items) && data.items.length ? data.items.map(normalizeItem) : [normalizeItem({})];
  return data;
}
function normalizeItem(item){
  return {
    name: String(item.name ?? "Item Baru"),
    desc: String(item.desc ?? ""),
    qty: Math.max(1, Number(item.qty) || 1),
    price: Math.max(0, Number(item.price) || 0),
    discount: clampNumber(item.discount, 0, 100, 0)
  };
}
function clampNumber(v,min,max,fallback){
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min,n));
}
function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(D));
}

function formatDate(value){
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "-" : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function formatCurrency(amount, currency=D.currency){
  const n = Number(amount) || 0;
  const configs = {
    IDR:{prefix:"Rp ", locale:"id-ID", digits:0},
    USD:{prefix:"$ ", locale:"en-US", digits:2},
    EUR:{prefix:"€ ", locale:"de-DE", digits:2},
    SGD:{prefix:"S$ ", locale:"en-SG", digits:2}
  };
  const c = configs[currency] || {prefix:"",locale:"en-US",digits:2};
  return c.prefix + n.toLocaleString(c.locale,{minimumFractionDigits:c.digits,maximumFractionDigits:c.digits});
}
function itemAmounts(item){
  const subtotal = item.qty * item.price;
  const discount = subtotal * (item.discount / 100);
  return {subtotal,discount,total:subtotal-discount};
}
function calculateTotals(){
  return D.items.reduce((acc,item)=>{
    const a=itemAmounts(item);
    acc.subtotal += a.subtotal; acc.discount += a.discount;
    return acc;
  },{subtotal:0,discount:0});
}


function render(){
  syncInvoiceDate();
  $("invNoD").textContent = D.invoiceNo || "#INV-001";

  $("fromN").textContent = D.fromName;
  $("fromD").textContent = D.fromDetail;
  $("toN").textContent = D.toName;
  $("toD").textContent = D.toDetail;
  $("invDt").textContent = formatDate(D.invoiceDate);
  $("dueDt").textContent = formatDate(D.dueDate);

  const currencyLabel = {IDR:"IDR (Rp)",USD:"USD ($)",EUR:"EUR (€)",SGD:"SGD (S$)"};
  $("curD").textContent = currencyLabel[D.currency] || D.currency;

  const body = $("tBody");
  body.replaceChildren();
  D.items.forEach((item,index)=>{
    const a=itemAmounts(item);
    const tr=document.createElement("tr");
    tr.innerHTML = `
      <td>${index+1}</td>
      <td><div class="item-n"></div><div class="item-s"></div></td>
      <td>${escapeHtml(item.qty)}</td>
      <td>${formatCurrency(item.price)}</td>
      <td>${formatCurrency(a.total)}</td>`;
    tr.querySelector(".item-n").textContent=item.name;
    tr.querySelector(".item-s").textContent=item.desc;
    body.appendChild(tr);
  });

  const totals=calculateTotals();
  const afterDiscount=totals.subtotal-totals.discount;
  const tax=afterDiscount*(D.taxPercent/100);
  const grand=afterDiscount+tax;
  $("subD").textContent=formatCurrency(totals.subtotal);
  $("discD").textContent="- "+formatCurrency(totals.discount);
  $("aftD").textContent=formatCurrency(afterDiscount);
  $("txP").textContent=D.taxPercent;
  $("txD").textContent=formatCurrency(tax);
  $("totD").textContent=formatCurrency(grand);
  $("notesD").textContent=D.notes;

  applyLogo();
}

function escapeHtml(value){
  const div=document.createElement("div");
  div.textContent=String(value);
  return div.innerHTML;
}

function openModal(){
  syncInvoiceDate();
  $("eNo").value=D.invoiceNo;
  $("eDt").value=D.invoiceDate;
  $("eDue").value=D.dueDate;
  $("eCur").value=D.currency;
  $("eTx").value=D.taxPercent;
  $("eFN").value=D.fromName;
  $("eFD").value=D.fromDetail;
  $("eTN").value=D.toName;
  $("eTD").value=D.toDetail;
  $("eNotes").value=D.notes;
  renderEditItems();
  loadLogoPreview();
  $("editMo").classList.add("on");
  document.body.style.overflow="hidden";
}
function closeModal(){
  $("editMo").classList.remove("on");
  document.body.style.overflow="";
}
function renderEditItems(){
  const body=$("eTBody");
  body.replaceChildren();
  D.items.forEach((item,index)=>{
    const total=itemAmounts(item).total;
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td><input type="text" class="fi" data-field="name"></td>
      <td><input type="text" class="fi" data-field="desc"></td>
      <td><input type="number" class="fi iq" min="1" step="1" data-field="qty"></td>
      <td><input type="number" class="fi ip" min="0" step="0.01" data-field="price"></td>
      <td><input type="number" class="fi iq" min="0" max="100" step="0.1" data-field="discount"></td>
      <td><div class="it-disp">${formatCurrency(total)}</div></td>
      <td><button type="button" class="rm-btn" title="Hapus item" data-remove><i class="fas fa-trash"></i></button></td>`;
    ["name","desc","qty","price","discount"].forEach(field=>{
      const input=tr.querySelector(`[data-field="${field}"]`);
      input.value=item[field];
      input.addEventListener("change",()=>{
        let value=input.value;
        if(field==="qty") value=Math.max(1,Number(value)||1);
        if(field==="price") value=Math.max(0,Number(value)||0);
        if(field==="discount") value=clampNumber(value,0,100,0);
        D.items[index][field]=value;
        renderEditItems();
        render();
      });
    });
    tr.querySelector("[data-remove]").addEventListener("click",()=>{
      if(D.items.length===1){toast("Minimal harus ada 1 item.","nfo");return;}
      D.items.splice(index,1);
      renderEditItems();
      render();
    });
    body.appendChild(tr);
  });
}
function addEItem(){
  D.items.push(normalizeItem({name:"Item Baru"}));
  renderEditItems();
  const box=document.querySelector(".mo-box");
  requestAnimationFrame(()=>box.scrollTop=box.scrollHeight);
}

function applyEdit(){
  const invoiceNo=$("eNo").value.trim();
  if(!invoiceNo){toast("Nomor invoice wajib diisi.","err");return;}
  if(!$("eDt").value || !$("eDue").value){toast("Tanggal invoice dan jatuh tempo wajib diisi.","err");return;}
  D.invoiceNo=invoiceNo;
  D.invoiceDate=getTodayISO();
  D.dueDate=$("eDue").value;
  D.currency=$("eCur").value;
  D.taxPercent=clampNumber($("eTx").value,0,100,0);
  D.fromName=$("eFN").value.trim() || "Pengirim";
  D.fromDetail=$("eFD").value.trim();
  D.toName=$("eTN").value.trim() || "Penerima";
  D.toDetail=$("eTD").value.trim();
  D.notes=$("eNotes").value.trim();
  D=normalizeData(D);
  saveData();
  render();
  closeModal();
  toast("Invoice berhasil diperbarui.","ok");
}

function getLogo(){
  try{return localStorage.getItem(LOGO_KEY)||""}catch{return ""}
}
function applyLogo(){
  const logo=getLogo();
  document.querySelectorAll("[data-logo]").forEach(container=>{
    if(logo){
      container.innerHTML=`<img src="${logo}" alt="Logo perusahaan">`;
    }else{
      container.innerHTML=`<i class="fas fa-file-invoice"></i>`;
    }
  });
}
function loadLogoPreview(){
  const logo=getLogo(), preview=$("logoPreview");
  preview.innerHTML="";
  if(logo){
    const img=new Image(); img.src=logo; img.alt="Logo"; preview.appendChild(img);
  }else{
    preview.innerHTML='<i class="fas fa-file-invoice"></i>';
  }
}
function handleLogoUpload(event){
  const file=event.target.files?.[0];
  if(!file)return;
  if(!["image/png","image/jpeg"].includes(file.type)){toast("Logo harus PNG atau JPG/JPEG.","err");event.target.value="";return;}
  if(file.size>2*1024*1024){toast("Ukuran logo maksimal 2 MB.","err");event.target.value="";return;}
  const reader=new FileReader();
  reader.onload=()=>{
    localStorage.setItem(LOGO_KEY,reader.result);
    loadLogoPreview(); applyLogo();
    toast("Logo berhasil diperbarui.","ok");
  };
  reader.readAsDataURL(file);
}
function resetLogo(){
  localStorage.removeItem(LOGO_KEY);
  loadLogoPreview(); applyLogo();
  $("logoInput").value="";
  toast("Logo dikembalikan ke logo default.","ok");
}

async function savePDF(){
  const loading=$("pdfLoad");
  loading.classList.add("on");

  let wrapper = null;

  try{
    const source=$("invoiceShell");
    const clone=source.cloneNode(true);

    clone.id="invoicePdfClone";
    clone.classList.add("pdf-export");

    // Never let the screen entrance animation affect html2canvas.
    clone.style.cssText += `
      width:190mm;
      margin:0 auto;
      border-radius:0;
      box-shadow:none;
      opacity:1 !important;
      transform:none !important;
      animation:none !important;
      transition:none !important;
      visibility:visible !important;
      background:#fff;
    `;

    wrapper=document.createElement("div");
    wrapper.className="pdf-export";
    wrapper.style.cssText=`
      position:fixed;
      left:-100000px;
      top:0;
      width:190mm;
      min-height:277mm;
      background:#fff;
      opacity:1;
      transform:none;
      animation:none;
      visibility:visible;
      z-index:-1;
    `;

    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    // Give the browser one frame to finish layout before html2canvas captures it.
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    if(document.fonts?.ready){
      await document.fonts.ready;
    }

    const options={
      margin:[8,10,8,10],
      filename:`${(D.invoiceNo||"invoice").replace(/[^a-z0-9_-]/gi,"")}_Nusawarna.pdf`,
      image:{type:"jpeg",quality:1},
      html2canvas:{
        scale:2,
        useCORS:true,
        backgroundColor:"#fff",
        logging:false,
        removeContainer:true
      },
      pagebreak:{
        mode:["css","legacy"],
        avoid:[".info-tile",".date-chip",".sum-grid",".inv-foot"]
      },
      jsPDF:{
        unit:"mm",
        format:"a4",
        orientation:"portrait",
        compress:true
      }
    };

    await html2pdf().set(options).from(clone).save();

    wrapper.remove();
    wrapper=null;
    loading.classList.remove("on");
    toast("PDF berhasil dibuat dengan tampilan yang lebih terang.","ok");
  }catch(error){
    if(wrapper) wrapper.remove();
    loading.classList.remove("on");
    console.error(error);
    toast("Gagal membuat PDF. Coba lagi.","err");
  }
}

function toast(message,type="nfo"){
  const box=$("toastBox"), item=document.createElement("div");
  item.className=`toast ${type}`;
  item.innerHTML=`<i class="fas ${type==="ok"?"fa-circle-check":type==="err"?"fa-circle-exclamation":"fa-circle-info"}"></i>`;
  const text=document.createElement("span"); text.textContent=message; item.appendChild(text);
  box.appendChild(item);
  setTimeout(()=>item.remove(),3200);
}

$("logoInput").addEventListener("change",handleLogoUpload);
$("editMo").addEventListener("click",event=>{if(event.target===$("editMo"))closeModal()});
document.addEventListener("keydown",event=>{if(event.key==="Escape" && $("editMo").classList.contains("on"))closeModal()});
window.openModal=openModal;
window.closeModal=closeModal;
window.addEItem=addEItem;
window.applyEdit=applyEdit;
window.savePDF=savePDF;
window.resetLogo=resetLogo;

render();

// Keep the invoice date synchronized with the current day while the page stays open.
let lastInvoiceDay = getTodayISO();
setInterval(()=>{
  const today = getTodayISO();
  if(today !== lastInvoiceDay){
    lastInvoiceDay = today;
    syncInvoiceDate();
    render();
  }
}, 30000);
