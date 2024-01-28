const fs = require("fs");
const path = require("path");
const bwipJs = require("bwip-js");
const PdfKit = require("pdfkit-table");
const dbConnect = require("../dbConnect/dbConnect");
const utilities = require("../utilities/utils");

exports.postSetPaperSize = async (req, res, next) => {
  const { paperWidth, paperHeight } = req.body;
  try {
    const connection = await dbConnect.getConnection();
    const paperSettings = await connection.execute(
      `SELECT * FROM PAPER_SETTING`
    );
    const convertedSizes = utilities.convertToPostScriptPoint(
      paperWidth,
      paperHeight
    );
    if (paperSettings.rows.length === 0) {
      await connection.execute(`INSERT INTO PAPER_SETTING (WIDTH, HEIGHT) 
      VALUES (${convertedSizes.pageWidth}, ${convertedSizes.pageHeight})`);
      await connection.tpcCommit();
    } else {
      await connection.execute(`UPDATE PAPER_SETTING SET WIDTH = ${convertedSizes.pageWidth},
      HEIGHT = ${convertedSizes.pageHeight}`);
      await connection.tpcCommit();
    }
    return res
      .status(201)
      .json({ success: true, message: "paper size is set successfully" });
  } catch (err) {
    next(err);
  }
};

exports.postGenerateBarcode = async (req, res, next) => {
  const printDetails = req.body.printDetails;
  const paperWidth = req.body.pageWidth;
  const paperHeight = req.body.pageHeight;
  try {
    const { pageHeight, pageWidth } = utilities.convertToPostScriptPoint(
      paperWidth,
      paperHeight
    );
    let labels = [];
    for (let print of printDetails) {
      for (let i = 0; i < print.numberOfBarcodes; ++i) {
        let barcodeBuffer = await bwipJs.toBuffer({
          bcid: "code128",
          text: print.assetNumber.toString(),
          scale: 2,
          height: 8,
          includetext: true,
          textxalign: "center",
        });
        let assetName = print.assetName;
        labels.push({ barcodeImage: barcodeBuffer, assentName: assetName });
      }
    }
    const reportName = "barcodes-" + Date.now() + ".pdf";
    const reportPath = path.join("barcodes", reportName);
    const arFont = path.join("fonts", "Janna.ttf");
    const fileUrl = `${req.protocol}s://${req.get(
      "host"
    )}/barcodes/${reportName}`;
    const Doc = new PdfKit({
      size: [Number(pageWidth), Number(pageHeight)],
      margin: 1,
    });
    Doc.pipe(fs.createWriteStream(reportPath));
    labels.forEach((barcodeObject, idx) => {
      Doc.font(arFont)
        .fontSize(10)
        .text(`${utilities.textDirection(barcodeObject.assentName)}`, {
          align: "center",
        });
      Doc.image(barcodeObject.barcodeImage, 5, 20, {
        width: 105,
        height: 45,
        align: "center",
      });
      if (idx < labels.length - 1) {
        Doc.addPage();
      }
    });
    Doc.end();
    res.status(201).json({
      success: true,
      barcodes: fileUrl,
    });
  } catch (err) {
    next(err);
  }
};

exports.postGenBulkBarcode = async (req, res, next) => {
  const printDetails = req.body.printDetails;
  try {
    const connection = await dbConnect.getConnection();
    const paperSettings = await connection.execute(
      `SELECT * FROM PAPER_SETTING`
    );
    const pageHeight = paperSettings.rows[0][1];
    const pageWidth = paperSettings.rows[0][2];
    const startBarcode = printDetails.range.from;
    const endBarcode = printDetails.range.to;
    if (endBarcode - startBarcode > 1000) {
      const error = new Error(
        "barcodes number out of range! range must be 1000 barcodes or less"
      );
      error.statusCode = 422;
      throw error;
    }
    const numberOfBarcode = printDetails.number;
    let labels = [];
    for (let i = startBarcode; i <= endBarcode; ++i) {
      for (let j = 0; j < numberOfBarcode; ++j) {
        let barcodeBuffer = await bwipJs.toBuffer({
          bcid: "code128",
          text: i.toString(),
          scale: 3,
          height: 8,
          includetext: true,
          textxalign: "center",
        });
        labels.push(barcodeBuffer);
      }
    }
    const reportName = "barcodes-" + Date.now() + ".pdf";
    const reportPath = path.join("barcodes", reportName);
    const logoPath = "./images/ALMJAL.png";
    const fileUrl = `${req.protocol}s://${req.get(
      "host"
    )}/barcodes/${reportName}`;
    const Doc = new PdfKit({ size: [pageWidth, pageHeight], margin: 0.5 });
    Doc.pipe(fs.createWriteStream(reportPath));
    labels.forEach((barcodeImage, idx) => {
      Doc.image(logoPath, 12, 1, {
        width: 110,
        height: 33,
        align: "center",
      });
      Doc.image(barcodeImage, 7, 34, {
        width: 130,
        height: 35,
        align: "center",
      });
      if (idx < labels.length - 1) {
        Doc.addPage();
      }
    });
    Doc.end();
    res.status(201).json({
      success: true,
      barcodes: fileUrl,
    });
  } catch (err) {
    next(err);
  }
};
