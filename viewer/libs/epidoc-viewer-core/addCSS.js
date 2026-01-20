const styles = `
.leiden-num-span  {
  float: left;
  width: 40px;
}

.leiden-transcription {
  font-family: "cyrillic-font";
  font-size: 18px;
}

.underline {
  text-decoration-line: underline;
}

.supraline {
    text-decoration-line: overline;
}

.strikethrough {
  text-decoration-line: line-through;
}

.section-heading {
  display:block;
  margin-top:1em
}

.single-space-holder::after { 
  content: '\\0020'; 
}
`

document.head.appendChild(document.createElement("style")).innerHTML=styles;




