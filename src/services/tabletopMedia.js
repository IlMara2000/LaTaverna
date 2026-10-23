// Shared tabletop media must not turn an embedded PDF into executable page content.
export function tabletopMediaUrl(value, base='https://taverna.invalid') {
    if(typeof value!=='string'||!value.trim())return '';
    try {const url=new URL(value,base);return ['https:','http:','blob:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
