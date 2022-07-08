  import PDFParser from 'pdf2json';
  import fs from 'fs';
  import { REPL_MODE_STRICT } from 'repl';

  const cleanUpText = (pages) => {
    pages.forEach((page) => {
      page.Texts.forEach(text => {
        text.R = text.R.map(r => {
          return { ...r, T: decodeURIComponent(r.T.replaceAll('%EF%BF%BD', '.')).trim() };
        });

        text.R = text.R.filter(r => !r.T.match(/^\d+$/))
      });
    });

    return pages;
  }

  const splitPdfdataByArmies = (pages) => {
    let sellerNumber = 0;
    let armyNumber = -1;
    const sellers = [{ name: 'GAMES WORKSHOP', armies: [] }, {name: 'FORGE WORLD', armies: [] }];
    pages.forEach((page) => {
      page.Texts.forEach((text) => {
        text.R.forEach(content => {
          if(content.TS[1] > 40) {
            sellerNumber = 1;
            armyNumber = 0;
          } else if(content.TS[1] === 34 || content.TS[1] === 40) {
            armyNumber++;
            sellers[sellerNumber].armies[armyNumber] = { name: content.T, datasheets: [] };
          } else {
            sellers[sellerNumber].armies[armyNumber].datasheets.push(content);
          }
        });
      });
    });

    return sellers;
  };

  const createText = (content) => {
    return content.reduce((text, line) => {
      // a stat line
      if(line.TS[1] === 11) {
        // end of a stat line
        if(
          line.T.endsWith('pt') ||
          line.T.endsWith('pts') ||
          line.T.endsWith('model') ||
          line.T.endsWith('models') ||
          line.T.endsWith('unit') ||
          line.T.endsWith('*') ||
          line.T.endsWith(':')
        ) {
          return text + line.T + '\n';
        } else {
          return text + line.T;
        }
      } else {
        return text + '\n' + line.T + '\n';
      }
    }, '');
  }

  const pdfParser = new PDFParser();

  pdfParser.on("pdfParser_dataReady", pdfData => {
    //remove content table
    const pages = pdfData.Pages.slice(1);

    //clean up
    const cleanedPages = cleanUpText(pages);

    //split by armies
    const sellersArray = splitPdfdataByArmies(cleanedPages);

    // create file for each army
    sellersArray.forEach((seller) => {
      if(!fs.existsSync(`./armies/${seller.name}`)) {
        fs.mkdirSync(`./armies/${seller.name}`)
      }

      seller.armies.forEach((army) => {
        army.text = createText(army.datasheets);
        fs.writeFile(`./armies/${seller.name}/${army.name}`, army.text, () => {});
      });
    })
  });

  pdfParser.loadPDF(process.argv[2]);