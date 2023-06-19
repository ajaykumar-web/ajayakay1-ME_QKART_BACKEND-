const httpStatus = require("http-status");
const { Cart, Product } = require("../models");
const ApiError = require("../utils/ApiError");
const config = require("../config/config");

/**
 * Fetches cart for a user
 * - Fetch user's cart from Mongo
 * - If cart doesn't exist, throw ApiError
 * --- status code  - 404 NOT FOUND
 * --- message - "User does not have a cart"
 *
 * @param {User} user
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const getCartByUser = async (user) => {
  const CartDoc = await Cart.findOne({ email: user.email });
  if (CartDoc == null) {
    throw new ApiError(httpStatus.NOT_FOUND, "User does not have a cart");
  }
  return CartDoc;
};

/**
 * Adds a new product to cart
 * - Get user's cart object using "Cart" model's findOne() method
 * --- If it doesn't exist, create one
 * --- If cart creation fails, throw ApiError with "500 Internal Server Error" status code
 *
 * - If product to add already in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product already in cart. Use the cart sidebar to update or remove product from cart"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - Otherwise, add product to user's cart
 *
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const addProductToCart = async (user, productId, quantity) => {
  const CartDoc = await Cart.findOne({ email: user.email });
  const ProductDoc = await Product.findById(productId);
  if (!ProductDoc) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Product doesn't exist in database"
    );
  }
  if (!CartDoc) {
    const productToCartDoc = await Cart.create({
      email: user.email,
      cartItems: [{ product: ProductDoc, quantity }],
      _id: user._id
    });
    if (!productToCartDoc) {
      throw new ApiError(
        httpStatus.INTERNAL_SERVER_ERROR,
        "Cart creation fails"
      );
    }
    return await productToCartDoc.save();
  }
  if (CartDoc.cartItems.some((items) => { return items.product._id == productId })) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Product already in cart. Use the cart sidebar to update or remove product from cart");
  }
  CartDoc.cartItems.push({ product: ProductDoc, quantity });
  await CartDoc.save();
  return CartDoc;
};

/**
 * Updates the quantity of an already existing product in cart
 * - Get user's cart object using "Cart" model's findOne() method
 * - If cart doesn't exist, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart. Use POST to create cart and add a product"
 *
 * - If product to add not in "products" collection in MongoDB, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product doesn't exist in database"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * - Otherwise, update the product's quantity in user's cart to the new quantity provided and return the cart object
 *
 *
 * @param {User} user
 * @param {string} productId
 * @param {number} quantity
 * @returns {Promise<Cart>}
 * @throws {ApiError}
 */
const updateProductInCart = async (user, productId, quantity) => {
  const userCart = await Cart.findOne({ email: user.email });
  if (!userCart) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User does not have a cart. Use POST to create cart and add a product");
  }
  const ProductDoc = await Product.findById(productId);
  if (!ProductDoc) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Product doesn't exist in database"
    );
  }
  const updateProduct = userCart.cartItems.find((items) => { return items.product._id.toString() == productId });
  if (!updateProduct) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Product not in cart"
    );
  }
  userCart.cartItems.map((items) => {
    if (items.product._id.toString() == productId) {
       items.quantity = quantity;
    }
  })

  const result = await userCart.save();
  return result;
};

/**
 * Deletes an already existing product in cart
 * - If cart doesn't exist for user, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "User does not have a cart"
 *
 * - If product to update not in user's cart, throw ApiError with
 * --- status code  - 400 BAD REQUEST
 * --- message - "Product not in cart"
 *
 * Otherwise, remove the product from user's cart
 *
 *
 * @param {User} user
 * @param {string} productId
 * @throws {ApiError}
 */
const deleteProductFromCart = async (user, productId) => {
  let userCart = await Cart.findOne({ email: user.email });
  if (!userCart) {
    throw new ApiError(httpStatus.BAD_REQUEST, "User does not have a cart. Use POST to create cart and add a product");
  }
  const deleteProduct = userCart.cartItems.find((items) => { return items.product._id == productId });
  if (!deleteProduct) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Product not in cart"
    );
  }
  let index = -1;
  userCart.cartItems.forEach((ele, i) => {
    if (ele.product._id.toString() === productId) {
      index = i;
    }
  });
  userCart.cartItems.splice(index, 1);
  const result = await userCart.save();
  return result;
};

// TODO: CRIO_TASK_MODULE_TEST - Implement checkout function
/**
 * Checkout a users cart.
 * On success, users cart must have no products.
 *
 * @param {User} user
 * @returns {Promise}
 * @throws {ApiError} when cart is invalid
 */
 const checkout = async (user) => {
  const userCart = await getCartByUser(user);
  const { cartItems } = userCart;

  if (cartItems.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "User's cart doesn't have any product"
    );
  }

  if (user && !(await user.hasSetNonDefaultAddress())) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Address not set");
  }

  let total = 0;
  for (let element of cartItems) {
    total = total + element.quantity * element.product.cost;
  }

  if (user.walletMoney < total) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Wallet balance is insufficient"
    );
  } else {
    const currentBalance = user.walletMoney - total;
    user.walletMoney = currentBalance;
    userCart.cartItems = [];
    await userCart.save();
    await user.save();
    return user;
  }
};

module.exports = {
  getCartByUser,
  addProductToCart,
  updateProductInCart,
  deleteProductFromCart,
  checkout,
};
