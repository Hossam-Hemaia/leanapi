const fs = require("fs");
const path = require("path");
const PdfKit = require("pdfkit-table");
const ExcelJs = require("exceljs");
const tafKita = require("./Tafqeet");
const axios = require("axios");
const bwipJs = require("bwip-js");
const qrcode = require("qrcode");
const FormData = require("form-data");
const nodemailer = require("nodemailer");

exports.createBarcode = async (barcode) => {
  try {
    const barcodeImg = await bwipJs.toBuffer({
      bcid: "code128",
      text: barcode,
      scale: 2,
      height: 7,
      includetext: false,
    });
    return barcodeImg;
  } catch (err) {
    throw new Error(err);
  }
};

exports.createQrcode = async (qrText) => {
  try {
    const qrCodeBuffer = await qrcode.toBuffer(qrText);
    return qrCodeBuffer;
  } catch (err) {
    throw new Error(err);
  }
};

exports.getMainHeader = async (headerId) => {
  try {
    const response = await axios.get(
      `https://alliwa.maxapex.net/apex/finc/header/header?com_id=${headerId}`
    );
    return response.data.items[0];
  } catch (err) {
    throw new Error(err);
  }
};

exports.getInvoiceHeader = async (invoiceId) => {
  try {
    const response = await axios.get(
      `https://alliwa.maxapex.net/apex/finc/inv_head/inv_head?inv_id=${invoiceId}`
    );
    return response.data.items[0];
  } catch (err) {
    throw new Error(err);
  }
};

exports.getInvoiceDetails = async (invoiceId) => {
  try {
    const response = await axios.get(
      `https://alliwa.maxapex.net/apex/finc/inv_table/inv_table?inv_id=${invoiceId}`
    );
    return response.data.items;
  } catch (err) {
    throw new Error(err);
  }
};

exports.textDirection = (str) => {
  let testStr = `${str}`;
  const isEnglishLetters = /^[a-zA-Z0-9]+$/.test(testStr.split(" ").join(""));
  const isNumbers = /^[0-9]+$/.test(testStr.split(" ").join(""));
  if (isEnglishLetters || isNumbers) {
    return str;
  } else {
    const strArr = testStr.split(" ");
    newStr = strArr.reverse().join(" ");
    return newStr;
  }
};

exports.numberfraction = (number) => {
  try {
    const numStr = number.toString();
    const fraction = numStr.split(".")[1];
    if (Number(fraction) > 0) {
      return fraction;
    } else {
      return false;
    }
  } catch (err) {
    throw new Error(err);
  }
};

exports.createPdfDoc = async (data) => {
  try {
    const reportName = `${data.invHeader.invoiceNumber}.pdf`;
    const reportPath = path.join("files", "pdfs", reportName);
    const arFont = path.join("assets", "font", "Almarai-Regular.ttf");
    const arFontBold = path.join("assets", "font", "Almarai-Bold.ttf");
    // prepare header
    const invoiceDetailsTable = [];
    let vouchersCount = 0;
    let itemsCount = 0;
    let unitsCount = 0;
    let qtyTotal = 0;
    let netBeforTaxTotal = 0;
    let taxTotal = 0;
    let totalAfterTaxSum = 0;
    for (let item of data.invBody) {
      ++vouchersCount;
      ++itemsCount;
      ++unitsCount;
      qtyTotal += item.quantity;
      netBeforTaxTotal += item.netAmountBeforeTax;
      taxTotal += item.taxAmount;
      totalAfterTaxSum += item.netAmountWithTax;
      let itemDetails = [];
      itemDetails.push(
        item?.netAmountWithTax || "",
        item?.taxAmount || "",
        item?.taxRatio || "",
        item?.netAmountBeforeTax || "",
        item?.priceBeforeTax || "",
        item?.quantity || "",
        this.textDirection(item?.unit || ""),
        this.textDirection(item?.item || ""),
        item?.voucherNumber || ""
      );
      invoiceDetailsTable.push(itemDetails);
    }
    invoiceDetailsTable.push([
      totalAfterTaxSum.toFixed(3),
      taxTotal.toFixed(3),
      "",
      netBeforTaxTotal.toFixed(3),
      "",
      qtyTotal,
      unitsCount,
      itemsCount,
      vouchersCount,
    ]);
    const itemsSummaryTable = [];
    for (let item of data.itemSummary) {
      itemsSummaryTable.push([
        item?.price || "",
        item?.qty || "",
        this.textDirection(item?.item || ""),
      ]);
    }
    const taxSummaryTable = [];
    for (let tax of data.taxSummary) {
      taxSummaryTable.push([
        tax?.amount || "",
        tax?.ratio || "",
        tax?.tax || "",
      ]);
    }
    const topHeaderTableRight = {
      headers: [
        { label: "بيان البائع", align: "right", width: 170 },
        { label: "البيان", align: "right", width: 90 },
      ],
      rows: [
        [
          this.textDirection(data.invHeader.sellerCompany),
          this.textDirection("اسم شركة البائع"),
        ],
        [
          this.textDirection(data.invHeader.sellerBranch),
          this.textDirection("اسم فرع البائع"),
        ],
        [
          this.textDirection(data.invHeader.sellerAddress),
          this.textDirection("عنوان البائع"),
        ],
        [
          this.textDirection(data.invHeader.sellerNumbers),
          this.textDirection("ارقام البائع"),
        ],
        [
          this.textDirection(data.invHeader.commRecord),
          this.textDirection("سجل تجارى"),
        ],
        [
          this.textDirection(data.invHeader.taxNumber),
          this.textDirection("رقم ضريبى البائع"),
        ],
      ],
    };
    const topHeaderTableleft = {
      headers: [
        { label: "Seller info", align: "left", width: 90 },
        { label: "البيان", align: "left", width: 170 },
      ],
      rows: [
        ["Seller Company", this.textDirection(data.invHeader.l_sellerCompany)],
        ["Seller Branch", this.textDirection(data.invHeader.l_sellerBranch)],
        ["Seller Address", this.textDirection(data.invHeader.l_sellerAddress)],
        ["Seller Numbers", this.textDirection(data.invHeader.l_sellerNumbers)],
        [
          "Seller Commercial Record",
          this.textDirection(data.invHeader.l_commRecord),
        ],
        ["Seller Tax Number", this.textDirection(data.invHeader.l_taxNumber)],
      ],
    };
    const invoiceHeaderRight = {
      headers: [
        { label: "بيان الفاتوره", align: "left", width: 80 },
        { label: "الفاتوره", align: "right", width: 80 },
        { label: "invoice info", align: "right", width: 70 },
      ],
      rows: [
        [
          "Invoice Number",
          this.textDirection(data.invHeader.invoiceNumber),
          this.textDirection("رقم الفاتوره"),
        ],
        [
          "Invoice Date",
          this.textDirection(data.invHeader.invoiceDate),
          this.textDirection("تاريخ الفاتوره"),
        ],
        [
          "Invoice Currency",
          this.textDirection(data.invHeader.currency),
          this.textDirection("عملة الفاتوره"),
        ],
      ],
    };
    const invoiceHeaderLeft = {
      headers: [
        { label: "نوع الفاتوره", align: "left", width: 70 },
        { label: "تاريخ التوريد", align: "left", width: 80 },
        { label: "invoice info", align: "right", width: 70 },
      ],
      rows: [
        [
          "Invoice Type",
          this.textDirection(data.invHeader.invoiceType),
          this.textDirection("نوع الفاتوره"),
        ],
        [
          "Supply Date",
          this.textDirection(data.invHeader.supplyDate),
          this.textDirection("تاريخ التوريد"),
        ],
        [
          "Duo Date",
          this.textDirection(data.invHeader.dueDate),
          this.textDirection("تاريخ الاستحقاق"),
        ],
      ],
    };
    const invoiceHeaderCustomer = {
      headers: [
        { label: "بيان الفاتوره", align: "left", width: 90 },
        { label: "الفاتوره", align: "right", width: 140 },
        { label: "invoice info", align: "right", width: 80 },
      ],
      rows: [
        [
          "Customer",
          this.textDirection(data.invHeader.customer),
          this.textDirection("العميل"),
        ],
        [
          "Customer Tax Number",
          this.textDirection(data.invHeader?.customerTaxNumber || ""),
          this.textDirection("رقم ضريبى العميل"),
        ],
        [
          "Customer Address",
          this.textDirection(data.invHeader?.customerAddress || ""),
          this.textDirection("عنوان العميل"),
        ],
        [
          "City",
          this.textDirection(data.invHeader?.city || ""),
          this.textDirection("المدينه"),
        ],
        [
          "Country",
          this.textDirection(data.invHeader?.country || ""),
          this.textDirection("الدوله"),
        ],
        [
          "Customer Commercial Record",
          this.textDirection(data.invHeader?.custCommRecord || ""),
          this.textDirection("سجل تجارى العميل"),
        ],
        [
          "Sub Account",
          this.textDirection(data.invHeader?.subAccount || ""),
          this.textDirection("الحساب الفرعى"),
        ],
      ],
    };
    const invoiceDetails = {
      headers: [
        {
          label: `Total After Tax  ${this.textDirection(
            "الاجمالى شامل الضرائب"
          )}`,
          align: "right",
          width: 90,
        },
        {
          label: `Tax Amount ${this.textDirection("قيمة الضرائب")}`,
          align: "right",
          width: 50,
        },
        {
          label: `Tax Ratio ${this.textDirection("نسبة الضرائب")}`,
          align: "right",
          width: 50,
        },
        {
          label: `Total Without Tax ${this.textDirection(
            "الاجمالى قبل الضرائب"
          )}`,
          align: "right",
          width: 80,
        },
        {
          label: `Unit Price Without Tax ${this.textDirection(
            "سعر الوحده قبل الضرائب"
          )}`,
          align: "right",
          width: 95,
        },
        {
          label: `${data.invHeader.transType < 3 ? "Qty" : "Rate"} ${
            data.invHeader.transType < 3
              ? this.textDirection("الكميه")
              : this.textDirection("النسبه")
          }`,
          align: "right",
          width: 30,
        },
        {
          label: `Unit ${this.textDirection("الوحده")}`,
          align: "right",
          width: 30,
        },
        {
          label: `Item Name ${this.textDirection("الصنف")}`,
          align: "right",
          width: 115,
        },
        {
          label: `Delivery Voucher ${this.textDirection("سند التسليم")}`,
          align: "right",
          width: 50,
        },
      ],
      rows: invoiceDetailsTable,
    };
    const invoiceSummary = {
      headers: [
        { label: "القيمه", align: "right", width: 70 },
        { label: "البيان", align: "right", width: 110 },
      ],
      rows: [
        [
          data.invFooter?.totalBeforTax || "",
          this.textDirection("الاجمالى قبل الضرائب"),
        ],
        [
          data.invFooter?.totalDiscount || "",
          this.textDirection("اجمالى الخصم"),
        ],
        [data.invFooter?.totalTax || "", this.textDirection("اجمالى الضرائب")],
        [
          data.invFooter?.totalAfterTax || "",
          this.textDirection("الاجمالى شامل الضرائب"),
        ],
      ],
    };
    const invoiceDuo = {
      headers: [
        { label: "القيمه", align: "right", width: 70 },
        { label: "البيان", align: "right", width: 110 },
      ],
      rows: [
        [data.invDuo?.totalDuo || "", this.textDirection("اجمالى المستحق")],
        [data.invDuo?.totalPaid || "", this.textDirection("اجمالى المدفوع")],
      ],
    };
    const itemSummary = {
      headers: [
        { label: "القيمه", align: "right", width: 70 },
        { label: "الكميه", align: "right", width: 80 },
        { label: "الصنف", align: "right", width: 80 },
      ],
      rows: itemsSummaryTable,
    };
    const taxSummary = {
      headers: [
        { label: "القيمه", align: "right", width: 70 },
        { label: "النسبه", align: "right", width: 80 },
        { label: "الضريبه", align: "right", width: 80 },
      ],
      rows: taxSummaryTable,
    };
    const Doc = new PdfKit({
      size: "A4",
      layout: "portrait",
      margins: { top: 10, bottom: 30, left: 1, right: 1 },
      bufferPages: true,
    });
    Doc.pipe(fs.createWriteStream(reportPath));
    Doc.image(data.invHeader.logo, 270, 5, {
      width: 70,
      height: 70,
    });
    await Doc.table(topHeaderTableRight, {
      prepareHeader: () => Doc.font(arFont).fontSize(9),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        Doc.font(arFont).fontSize(10);
        indexColumn === 0 && Doc.addBackground(rectRow, "white", 0.15);
      },
      hideHeader: true,
      divider: {
        horizontal: { disabled: true, opacity: 0 },
      },
      x: 330,
      y: 50,
    });
    await Doc.table(topHeaderTableleft, {
      prepareHeader: () => Doc.font(arFont).fontSize(9),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        Doc.font(arFont).fontSize(10);
        indexColumn === 0 && Doc.addBackground(rectRow, "white", 0.15);
      },
      hideHeader: true,
      divider: {
        horizontal: { disabled: true, opacity: 0 },
      },
      x: 20,
      y: 50,
    });
    Doc.image(data.invHeader.barcode, 20, 170, {
      width: 120,
      height: 30,
    });
    if (data.invHeader.transType === 1) {
      Doc.font(arFontBold)
        .fontSize(16)
        .text(`Tax Invoice - ${this.textDirection("فاتوره ضريبيه")}`, {
          align: "center",
        });
    } else if (data.invHeader.transType === 2) {
      Doc.font(arFontBold)
        .fontSize(16)
        .text(`Return Invoice - ${this.textDirection("فاتورة مرتجع")}`, {
          align: "center",
        });
    } else if (data.invHeader.transType === 4) {
      Doc.font(arFontBold)
        .fontSize(16)
        .text(`Debit Note - ${this.textDirection("اشعار مدين")}`, {
          align: "center",
        });
    } else if (data.invHeader.transType === 3) {
      Doc.font(arFontBold)
        .fontSize(16)
        .text(`Credit Note - ${this.textDirection("اشعار دائن")}`, {
          align: "center",
        });
    }
    await Doc.table(invoiceHeaderRight, {
      prepareHeader: () => Doc.font(arFont).fontSize(9),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        Doc.font(arFont).fontSize(10);
        indexColumn === 0 && Doc.addBackground(rectRow, "white", 0.15);
      },
      hideHeader: true,
      divider: {
        horizontal: { disabled: true, opacity: 0 },
      },
      x: 360,
      y: 210,
    });
    await Doc.table(invoiceHeaderLeft, {
      prepareHeader: () => Doc.font(arFont).fontSize(9),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        Doc.font(arFont).fontSize(10);
        indexColumn === 0 && Doc.addBackground(rectRow, "white", 0.15);
      },
      hideHeader: true,
      divider: {
        horizontal: { disabled: true, opacity: 0 },
      },
      x: 10,
      y: 210,
    });
    await Doc.table(invoiceHeaderCustomer, {
      prepareHeader: () => Doc.font(arFont).fontSize(9),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        Doc.font(arFont).fontSize(10);
        indexColumn === 0 && Doc.addBackground(rectRow, "white", 0.15);
      },
      hideHeader: true,
      divider: {
        horizontal: { disabled: true, opacity: 0 },
      },
      x: 280,
      y: 280,
    });
    Doc.rect(10, 205, 580, 0).stroke();
    Doc.image(data.invHeader.qrCode, 20, 290, {
      width: 120,
      height: 120,
    });
    await Doc.table(invoiceDetails, {
      prepareHeader: () => {
        Doc.font(arFont).fontSize(8);
      },
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        Doc.font(arFont).fontSize(8);
        indexColumn === 0 &&
          Doc.addBackground(
            rectRow,
            indexRow === invoiceDetailsTable.length - 1 ? "grey" : "white",
            0.5
          );
      },
      divider: {
        header: { disabled: false, width: 0.5, opacity: 2 },
        horizontal: { disabled: false, width: 0.5, opacity: 1 },
      },
      x: 2,
    });
    const pageHeight = Doc.page.height;
    const fixedHeaderHeight = 29 * 15;
    let currentPages = Doc.bufferedPageRange();
    const detailsTableHeight = invoiceDetailsTable.length * 20 + 30;
    let remainingHeight;
    if (currentPages.count === 1) {
      remainingHeight = pageHeight - (fixedHeaderHeight + detailsTableHeight);
    }
    if (remainingHeight < 120 && currentPages.count === 1) {
      Doc.addPage();
      remainingHeight = pageHeight;
    } else {
      remainingHeight -= 90;
    }
    await Doc.table(invoiceSummary, {
      prepareHeader: () => Doc.font(arFont).fontSize(9),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        Doc.font(arFont).fontSize(9);
        indexColumn === 0 && Doc.addBackground(rectRow, "white", 0.15);
      },
      hideHeader: false,
      divider: {
        header: { disabled: false, width: 0.5, opacity: 2 },
        horizontal: { disabled: false, width: 0.5, opacity: 1 },
      },
      x: 10,
    });
    const fraction = this.numberfraction(data.invFooter.totalAfterTax);
    if (!fraction) {
      Doc.font(arFont)
        .fontSize(10)
        .text(
          `${this.textDirection(
            "فقط " +
              tafKita(data.invFooter.totalAfterTax) +
              ` ${data.invHeader.currency} ` +
              " لاغير"
          )}`,
          {
            align: "center",
          }
        );
    } else {
      Doc.font(arFont)
        .fontSize(10)
        .text(
          `${this.textDirection(
            "فقط " +
              tafKita(data.invFooter.totalAfterTax) +
              ` ${data.invHeader.currency} ` +
              " و " +
              `100/${fraction}` +
              " لاغير"
          )}`,
          {
            align: "center",
          }
        );
    }
    Doc.text("          ");
    if (remainingHeight < 110 && currentPages.count === 1) {
      Doc.addPage();
      remainingHeight = pageHeight;
    } else {
      remainingHeight -= 85;
    }
    await Doc.table(invoiceDuo, {
      prepareHeader: () => Doc.font(arFont).fontSize(9),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        Doc.font(arFont).fontSize(9);
        indexColumn === 0 && Doc.addBackground(rectRow, "white", 0.15);
      },
      hideHeader: false,
      divider: {
        header: { disabled: false, width: 0.5, opacity: 2 },
        horizontal: { disabled: false, width: 0.5, opacity: 1 },
      },
      x: 10,
    });
    if (remainingHeight < 75 && currentPages.count === 1) {
      Doc.addPage();
      remainingHeight = pageHeight;
    } else {
      remainingHeight -= 45;
    }
    await Doc.table(itemSummary, {
      title: this.textDirection("ملخص الاصناف"),
      prepareHeader: () => Doc.font(arFont).fontSize(9),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        Doc.font(arFont).fontSize(10);
        indexColumn === 0 && Doc.addBackground(rectRow, "white", 0.15);
      },
      hideHeader: false,
      divider: {
        horizontal: { disabled: false, opacity: 0 },
      },
      x: 350,
    });
    if (remainingHeight < 75 && currentPages.count === 1) {
      Doc.addPage();
      remainingHeight = pageHeight;
    } else {
      remainingHeight -= 45;
    }
    await Doc.table(taxSummary, {
      title: this.textDirection("ملخص الضرائب"),
      prepareHeader: () => Doc.font(arFont).fontSize(9),
      prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
        Doc.font(arFont).fontSize(10);
        indexColumn === 0 && Doc.addBackground(rectRow, "white", 0.15);
      },
      hideHeader: false,
      divider: {
        horizontal: { disabled: false, opacity: 0 },
      },
      x: 350,
    });
    if (remainingHeight < 75 && currentPages.count === 1) {
      Doc.addPage();
      remainingHeight = pageHeight;
    } else {
      remainingHeight -= 45;
    }
    Doc.font(arFont)
      .fontSize(12)
      .text(
        `                                                                                 ${this.textDirection(
          "استلام العميل"
        )}                                                                   ${this.textDirection(
          "إنشاء: " + data.username
        )}`,
        10,
        null
      );
    Doc.font(arFont)
      .fontSize(12)
      .text(
        `                                                                                                  ${this.textDirection(
          "الإسم:"
        )}                                                                                                                           ${this.textDirection(
          "التوقيع:"
        )} `,
        10,
        null
      );
    Doc.font(arFont)
      .fontSize(12)
      .text(
        `                                                                                                ${this.textDirection(
          "التوقيع:"
        )}`,
        10,
        null
      );
    let pages = Doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      Doc.switchToPage(i);
      //Footer: Add page number
      let oldBottomMargin = Doc.page.margins.bottom;
      Doc.page.margins.bottom = 0;
      Doc.text(
        `Page: ${i + 1} of ${pages.count}`,
        0,
        Doc.page.height - oldBottomMargin / 2,
        { align: "center" }
      );
      Doc.page.margins.bottom = oldBottomMargin;
    }
    Doc.end();
    return reportName;
  } catch (err) {
    console.log(err);
    throw new Error(err);
  }
};

exports.createExcelDoc = async (data) => {
  const invoiceDetailsTable = [];
  let vouchersCount = 0;
  let itemsCount = 0;
  let flagsCount = 0;
  let unitsCount = 0;
  let qtyTotal = 0;
  let netBeforTaxTotal = 0;
  let taxTotal = 0;
  let totalAfterTaxSum = 0;
  for (let item of data.invBody) {
    ++vouchersCount;
    ++itemsCount;
    ++flagsCount;
    ++unitsCount;
    qtyTotal += item.quantity;
    netBeforTaxTotal += item.netAmountBeforeTax;
    taxTotal += item.taxAmount;
    totalAfterTaxSum += item.netAmountWithTax;
    let itemDetails = [];
    itemDetails.push(
      item.voucherNumber,
      item.item,
      item.distinction,
      item.unit,
      item.quantity,
      item.priceBeforeTax,
      item.netAmountBeforeTax,
      item.taxRatio,
      item.taxAmount,
      item.netAmountWithTax
    );
    invoiceDetailsTable.push(itemDetails);
  }
  invoiceDetailsTable.push([
    vouchersCount,
    itemsCount,
    flagsCount,
    unitsCount,
    qtyTotal,
    "",
    netBeforTaxTotal.toFixed(3),
    "",
    taxTotal.toFixed(3),
    totalAfterTaxSum.toFixed(3),
  ]);
  const itemsSummaryTable = [];
  for (let item of data.itemSummary) {
    itemsSummaryTable.push([item.price, item.qty, item.item]);
  }
  const taxSummaryTable = [];
  for (let tax of data.taxSummary) {
    taxSummaryTable.push([tax.amount, tax.ratio, tax.tax]);
  }
  try {
    const logoImg = path.join("assets", "img", "logo.jpeg");
    const fileName = `${data.invHeader.invoiceNumber}.xlsx`;
    const filePath = path.join("files", "xls", fileName);
    const workbook = new ExcelJs.Workbook();
    workbook.created = new Date();
    workbook.calcProperties.fullCalcOnLoad = true;
    workbook.views = [
      {
        x: 0,
        y: 0,
        width: 10000,
        height: 20000,
        firstSheet: 0,
        activeTab: 1,
        visibility: "visible",
      },
    ];
    const sheet = workbook.addWorksheet("invoice");
    sheet.views = [{ rightToLeft: true }];
    const logoId = workbook.addImage({
      filename: logoImg,
      extension: "jpeg",
    });
    sheet.addImage(logoId, "D1:E3");
    sheet.addTable({
      name: "corpAr",
      ref: "A1",
      headerRow: false,
      totalsRow: false,
      // style: {
      //   theme: 'TableStyleDark3',
      //   showRowStripes: true,
      // },
      columns: [{ name: "seller corp" }, { name: "data" }],
      rows: [
        ["اسم شركة البائع", data.invHeader.sellerCompany],
        ["اسم فرع البائع", data.invHeader.sellerBranch],
        ["عنوان البائع", data.invHeader.sellerAddress],
        ["ارقام البائع", data.invHeader.sellerNumbers],
        ["سجل تجارى", data.invHeader.commRecord],
        ["رقم ضريبى البائع", data.invHeader.taxNumber],
      ],
    });
    const columnA = sheet.getColumn("A");
    columnA.width = 20;
    columnA.alignment = { horizontal: "right" };
    const columnB = sheet.getColumn("B");
    columnB.width = 30;
    columnB.alignment = { horizontal: "right" };
    columnB.alignment.wrapText = true;
    sheet.addTable({
      name: "corpEn",
      ref: "G1",
      headerRow: false,
      totalsRow: false,
      // style: {
      //   theme: 'TableStyleDark3',
      //   showRowStripes: true,
      // },
      columns: [{ name: "seller corp" }, { name: "data" }],
      rows: [
        [data.invHeader.sellerCompany, "Seller Company"],
        [data.invHeader.sellerBranch, "Seller Branch"],
        [data.invHeader.sellerAddress, "Seller Address"],
        [data.invHeader.sellerNumbers, "Seller Numbers"],
        [data.invHeader.commRecord, "Seller Commercial Record"],
        [data.invHeader.taxNumber, "Seller Tax Number"],
      ],
    });
    const columnG = sheet.getColumn("G");
    columnG.width = 30;
    columnG.alignment = { horizontal: "left" };
    const columnH = sheet.getColumn("H");
    columnH.width = 20;
    columnH.alignment = { horizontal: "left" };
    columnH.alignment.wrapText = true;
    sheet.mergeCells("C7:E7");
    if (data.invHeader.transType === 1) {
      sheet.getCell("C7").value = "فاتوره ضريبيه - Tax Invoice";
    } else if (data.invHeader.transType === 2) {
      sheet.getCell("C7").value = "فاتورة مرتجع - Return Invoice";
    } else if (data.invHeader.transType === 3) {
      sheet.getCell("C7").value = "اشعار دائن - Credit Note";
    } else if (data.invHeader.transType === 4) {
      sheet.getCell("C7").value = "اشعار مدين - Debit Note";
    }
    sheet.addTable({
      name: "invHeadRight",
      ref: "A9",
      headerRow: false,
      totalsRow: false,
      columns: [{ name: "seller corp" }, { name: "data" }, { name: "data2" }],
      rows: [
        ["رقم الفاتوره", data.invHeader.invoiceNumber, "Invoice Number"],
        ["تاريخ الفاتوره", data.invHeader.invoiceDate, "Invoice Date"],
        ["عملة الفاتوره", data.invHeader.currency, "Invoice Currency"],
      ],
    });
    const columnC = sheet.getColumn("C");
    columnC.width = 20;
    columnC.alignment = { horizontal: "left" };
    columnC.alignment.wrapText = true;
    sheet.addTable({
      name: "invHeadLeft",
      ref: "G9",
      headerRow: false,
      totalsRow: false,
      columns: [{ name: "seller corp" }, { name: "data" }, { name: "data2" }],
      rows: [
        ["نوع الفاتوره", data.invHeader.invoiceType, "Invoice Type"],
        ["تاريخ التوريد", data.invHeader.supplyDate, "Supply Date"],
        ["تاريخ الاستحقاق", data.invHeader.dueDate, "Duo Date"],
      ],
    });
    const columnI = sheet.getColumn("I");
    columnI.width = 20;
    columnI.alignment = { horizontal: "left" };
    columnI.alignment.wrapText = true;
    sheet.addTable({
      name: "invHeadRight",
      ref: "A13",
      headerRow: false,
      totalsRow: false,
      columns: [{ name: "seller corp" }, { name: "data" }, { name: "data2" }],
      rows: [
        ["العميل", data.invHeader.customer, "Customer"],
        [
          "رقم ضريبى العميل",
          data.invHeader.customerTaxNumber,
          "Customer Tax Number",
        ],
        ["عنوان العميل", data.invHeader.customerAddress, "Customer Address"],
        ["المدينه", data.invHeader.city, "City"],
        ["الدوله", data.invHeader.country, "Country"],
        [
          "سجل تجارى العميل",
          data.invHeader.custCommRecord,
          "Customer Commercial Record",
        ],
        ["الحساب الفرعى", data.invHeader.subAccount, "Sub Account"],
      ],
    });
    sheet.addTable({
      name: "invHeadRight",
      ref: "A21",
      headerRow: true,
      totalsRow: false,
      columns: [
        {
          name: `Delivery Voucher سند التسليم`,
        },
        {
          name: `Item Name الصنف`,
        },
        {
          name: `Flag مميز`,
        },
        {
          name: `Unit الوحده`,
        },
        {
          name: `Qty الكميه`,
        },
        {
          name: `Unit Price Without Tax سعر الوحده قبل الضرائب`,
        },
        {
          name: `Total Without Tax الاجمالى قبل الضرائب`,
        },
        {
          name: `Tax Ratio نسبة الضرائب`,
        },
        {
          name: `Tax Amount قيمة الضرائب`,
        },
        {
          name: `Total After Tax الاجمالى شامل الضرائب`,
        },
      ],
      rows: invoiceDetailsTable,
    });
    const invoiceRows = sheet.getRows(21, 22 + invoiceDetailsTable.length);
    invoiceRows.forEach((row, rowIndex) => {
      row.eachCell({ includeEmpty: true }, function (cell, colNumber) {
        cell.alignment = { horizontal: "center" };
      });
    });
    sheet.addTable({
      name: "invSummary",
      ref: `G${invoiceDetailsTable.length + 23}`,
      style: {
        showRowStripes: true,
      },
      headerRow: true,
      totalsRow: false,
      columns: [{ name: "البيان" }, { name: "القيمه" }],
      rows: [
        ["الاجمالى قبل الضرائب", data.invFooter.totalBeforTax],
        ["اجمالى الخصم", data.invFooter.totalDiscount],
        ["اجمالى الضرائب", data.invFooter.totalTax],
        ["الاجمالى شامل الضرائب", data.invFooter.totalAfterTax],
      ],
    });
    sheet.mergeCells(
      `F${invoiceDetailsTable.length + 29}:J${invoiceDetailsTable.length + 29}`
    );
    sheet.getCell(`F${invoiceDetailsTable.length + 29}`).value = tafKita(
      data.invDuo.totalDuo
    );
    sheet.getCell(`B${invoiceDetailsTable.length + 30}`).value = "ملخص الاصناف";
    sheet.getCell(`G${invoiceDetailsTable.length + 30}`).value = "ملخص الضرائب";
    sheet.addTable({
      name: "invHeadRight",
      ref: `A${invoiceDetailsTable.length + 31}`,
      headerRow: true,
      totalsRow: false,
      columns: [
        {
          name: `الصنف`,
        },
        {
          name: `الكميه`,
        },
        {
          name: `القيمه`,
        },
      ],
      rows: itemsSummaryTable,
    });
    sheet.addTable({
      name: "invHeadRight",
      ref: `F${invoiceDetailsTable.length + 31}`,
      headerRow: true,
      totalsRow: false,
      columns: [
        {
          name: `الضريبه`,
        },
        {
          name: `النسبه`,
        },
        {
          name: `القيمه`,
        },
      ],
      rows: taxSummaryTable,
    });
    sheet.getCell(
      `A${invoiceDetailsTable.length + 31 + itemsSummaryTable.length + 2}`
    ).value = "انشاء";
    sheet.getCell(
      `B${invoiceDetailsTable.length + 31 + itemsSummaryTable.length + 2}`
    ).value = new Date().toString().split("GMT")[0];
    sheet.getCell(
      `F${invoiceDetailsTable.length + 31 + itemsSummaryTable.length + 2}`
    ).value = "استلام العميل";
    sheet.getCell(
      `A${invoiceDetailsTable.length + 31 + itemsSummaryTable.length + 3}`
    ).value = "التوقيع";
    sheet.getCell(
      `F${invoiceDetailsTable.length + 31 + itemsSummaryTable.length + 3}`
    ).value = "الاسم";
    sheet.getCell(
      `F${invoiceDetailsTable.length + 31 + itemsSummaryTable.length + 4}`
    ).value = "التوقيع";
    await workbook.xlsx.writeFile(filePath);
    return fileName;
  } catch (err) {
    throw new Error(err);
  }
};

exports.uploadInvoice = async (fileName, fileType) => {
  try {
    const folderType = fileType === "pdf" ? "pdfs" : "xls";
    const filePath = path.join("files", folderType, fileName);
    fs.stat(filePath, (err, stats) => {
      if (err) {
        if (err.code === "ENOENT") {
          console.log("file does not exist!");
        }
      }
    });
    const formData = new FormData();
    formData.append("folder", "inv");
    formData.append("attachs[0]", fs.createReadStream(filePath));
    const uploadUrl = "https://alliwa.maxapex.net/attach/index.php";
    const response = await axios.post(uploadUrl, formData, {
      timeout: 30000,
      headers: {
        ...formData.getHeaders(),
      },
    });
    return response.data;
  } catch (err) {
    throw new Error(err);
  }
};

exports.deleteInvoiceFile = async (fileName, fileType) => {
  try {
    const formData = new FormData();
    formData.append("file", `inv/${fileName}`);
    const uploadUrl = "https://alliwa.maxapex.net/attach/del.php";
    const response = await axios.post(uploadUrl, formData, {
      headers: {
        "Content-Type": `multipart/form-data;`,
      },
    });
    return response.data;
  } catch (err) {
    throw new Error(err);
  }
};

// exports.emailSender = async (email, ccMail, fileName, filePath, message) => {
//   let transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL,
//       pass: process.env.EMAIL_PASS,
//     },
//   });
//   let emailOptions = {
//     from: process.env.EMAIL,
//     to: email,
//     bcc: ccMail,
//     subject: "Alliwa Invoice",
//     text: `${message}`,
//     attachments: [
//       {
//         filename: fileName, // The name you want the file to have in the email
//         path: filePath, // The path to the file you want to attach
//       },
//     ],
//   };
//   const emailStatus = await transporter.sendMail(emailOptions);
//   console.log(emailStatus);
// };

exports.convertToPostScriptPoint = (paperWidth, paperHeight) => {
  const postScriptPoint = 28.346456693;
  const pageWidth = (paperWidth * postScriptPoint).toFixed(2);
  const pageHeight = (paperHeight * postScriptPoint).toFixed(2);
  return { pageWidth, pageHeight };
};

exports.generateKeyValueObject = (data) => {
  try {
    const objects = [];
    for (let i = 0; i < data.rows.length; ++i) {
      let object = {};
      for (let j = 0; j < data.rows[i].length; ++j) {
        object[data.metaData[j].name] = data.rows[i][j];
      }
      objects.push(object);
    }
    return objects;
  } catch (err) {
    throw err;
  }
};

exports.getLocalDate = (date) => {
  const newDate = new Date(date);
  const localDate = new Date(
    newDate.getTime() - newDate.getTimezoneOffset() * 60000
  );
  return localDate;
};

exports.emailSender = async (email, title, message) => {
  console.log("sending email");
  let transporter = nodemailer.createTransport({
    host: "smtp.ipage.com",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.EMAIL_PASS,
      method: "LOGIN",
    },
    port: 465,
    secure: true,
    tls: {
      rejectUnauthorized: false,
    },
    debug: true,
  });
  let emailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: title,
    text: message,
  };
  const emailStatus = await transporter.sendMail(emailOptions);
  console.log(emailStatus);
};
