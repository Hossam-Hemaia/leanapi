const dbConnect = require("../dbConnect/dbConnect");

exports.getItemDetails = async (req, res, next) => {
  const itemBarcode = req.query.itemBarcode;
  try {
    const connection = await dbConnect.getConnection();
    const item = await connection.execute(
      `SELECT ITEM_NAME, ITEM_NAME_EN FROM ITEMS WHERE ITEM_CODE='${itemBarcode}'`
    );
    if (item.rows.length === 0) {
      return res
        .status(422)
        .json({ success: false, message: "Item does not exist!" });
    }
    res.status(200).json({ success: true, item: item });
  } catch (err) {
    next(err);
  }
};

exports.postCreateItemInventory = async (req, res, next) => {
  const { itemBarcode, quantity, username } = req.body;
  try {
    const date = new Date().toLocaleDateString();
    const connection = await dbConnect.getConnection();
    const itemRecord = await connection.execute(
      `INSERT INTO INVENTORY_SCAN (ITEM_CODE, QUANTITY, USERNAME)
      VALUES ('${itemBarcode}', ${quantity}, '${username}')`
    );
    await connection.tpcCommit();
    if (itemRecord.rowsAffected === 1) {
      return res
        .status(201)
        .json({ success: true, message: "Record Created!" });
    } else {
      return res
        .status(422)
        .json({ success: false, message: "Faild to create record!" });
    }
  } catch (err) {
    next(err);
  }
};

exports.putUpdateAsset = async (req, res, next) => {
  const {
    assetNumber,
    location,
    inventory,
    employeeNumber,
    assignFromDate,
    quantity,
  } = req.body;
  const image = req.file;
  try {
    const connection = await dbConnect.getConnection();
    if (image) {
      const imagePath = `${req.protocol}s://${req.hostname}/${image.path}`;
      const date = new Date(assignFromDate).toLocaleDateString();
      await connection.execute(
        `UPDATE XXASSET_TRANSACTIONS SET LOCATION = '${location}', SUB_INVENTORY = '${inventory}',
         EMP_NUMBER = '${employeeNumber}', ASSIGN_FROM_DATE = '${date}', QTY = '${quantity}', URL_IMG='${imagePath}'
         WHERE ASSET_NUMBER = ${assetNumber}`
      );
      await connection.tpcCommit();
      return res
        .status(201)
        .json({ success: true, message: "Asset Record Updated" });
    } else {
      const date = new Date(assignFromDate).toLocaleDateString();
      await connection.execute(
        `UPDATE XXASSET_TRANSACTIONS SET LOCATION = '${location}', SUB_INVENTORY = '${inventory}',
         EMP_NUMBER = '${employeeNumber}', ASSIGN_FROM_DATE = '${date}', QTY = '${quantity}'
         WHERE ASSET_NUMBER = ${assetNumber}`
      );
      await connection.tpcCommit();
      return res
        .status(201)
        .json({ success: true, message: "Asset Record Updated" });
    }
  } catch (err) {
    next(err);
  }
};
