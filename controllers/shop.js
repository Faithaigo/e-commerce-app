const fs = require('fs')
const path = require('path')
const PDFDocument = require('pdfkit')
const Product = require('../models/product');
const Order = require('../models/order');
const stripe = require('stripe')(process.env.STRIPE_KEY)



const ITEMS_PER_PAGE = 1;

exports.getProducts = (req, res, next) => {
    const page = +req.query.page || 1;
    let totalItems;
    Product.find().countDocuments().then(numProducts=>{
      totalItems = numProducts
      return Product.find()
      .skip((page - 1) * ITEMS_PER_PAGE) //skip the items ie page 2 will skip 2 items and move to the next items
      .limit(ITEMS_PER_PAGE) //limits the number of items fetcheed to the items per page specified
    }).then(products => {
        res.render('shop/product-list', {
          prods: products,
          pageTitle: 'All Products',
          path: '/products',
          totalProducts: totalItems,
          currentPage:page,
          hasNextPage: ITEMS_PER_PAGE * page < totalItems,
          hasPreviousPage: page > 1,
          nextPage : (page) + 1,
          previousPage: page - 1,
          lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
        });
      })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getIndex = (req, res, next) => {
  const page = +req.query.page || 1;
  let totalItems;
  Product.find().countDocuments().then(numProducts=>{
    totalItems = numProducts
    return Product.find()
    .skip((page - 1) * ITEMS_PER_PAGE) //skip the items ie page 2 will skip 2 items and move to the next items
    .limit(ITEMS_PER_PAGE) //limits the number of items fetcheed to the items per page specified
  }).then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        totalProducts: totalItems,
        currentPage:page,
        hasNextPage: ITEMS_PER_PAGE * page < totalItems,
        hasPreviousPage: page > 1,
        nextPage : (page) + 1,
        previousPage: page - 1,
        lastPage: Math.ceil(totalItems / ITEMS_PER_PAGE)
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
    })
    .catch(err => {
      console.log(err)
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) =>{
  let products;
  let total = 0
  req.user
  .populate('cart.items.productId')
  .then(user => {
    products = user.cart.items;
    total = 0;
    products.forEach(p=>{
      total += p.quantity * p.productId.price
    })
    return stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: products.map(p=>({
        quantity:p.quantity,
        price_data:{
          currency:'usd',
          unit_amount: p.productId.price * 100,
          product_data:{
            name:p.productId.title,
            description:p.productId.description,
          }
        }
      })),
      mode:'payment',
      success_url:`${req.protocol}://${req.host}/checkout/success`, //dynamically derive the url the node server is running on,
      cancel_url:`${req.protocol}://${req.host}/checkout/cancel`
    })
  }).then(session=>{
    res.render('shop/checkout', {
      path: '/checkout',
      pageTitle: 'Checkout',
      products: products,
      totalSum: total,
      sessionId:session.id
    });
  })
  .catch(err => {
    console.log(err)
    const error = new Error(err);
    error.httpStatusCode = 500;
    return next(error);
  });
}



exports.getCheckoutSuccess = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postOrder = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) =>{
  const orderId = req.params.orderId;
  Order.findById(orderId).then(order=>{
    if(!order){
      return next(new Error('No order found.'))
    }
    if(order.user.userId.toString() !== req.user._id.toString()){
      return next(new Error('Unauthorized'))
    }
    const invoiceName = `invoice-${orderId}.pdf`
    const invoicePath = path.join('data', 'invoices', invoiceName)

    res.setHeader('Content-Type','application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${invoiceName}"`)

    const pdfDoc = new PDFDocument()
    pdfDoc.pipe(fs.createWriteStream(invoicePath))
    pdfDoc.pipe(res)

    pdfDoc.fontSize(26).text('Invoice',{
      underline:true
    })
    pdfDoc.text('----------------------------')

    let totalPrice = 0

    order.products.forEach(prod=>{
      totalPrice  += prod.quantity * prod.product.price;
      pdfDoc.fontSize(14).text(prod.product.title + ' - ' + prod.quantity + ' x ' + prod.product.price)
    })
    pdfDoc.text('----')
    pdfDoc.text('Total Price ' + totalPrice)


    pdfDoc.end()
    //Reads file data into memory, this method is only good for small files but for bigger files it will cause memory overflow because you are reading from memory
    //this method also preloads all the data into memory
    // fs.readFile(invoicePath,(error, data)=>{
    //   if(error){
    //     return next()
    //   }
    //   res.setHeader('Content-Type','application/pdf')
    //   res.setHeader('Content-Disposition', `attachment; filename="${invoiceName}"`)
    //   res.send(data)
    // })

    //streaming data, read file step by step in different chunnks, streams to the client on the fly, doesn't preload it
    // const file = fs.createReadStream(invoicePath)
    // res.setHeader('Content-Type','application/pdf')
    // res.setHeader('Content-Disposition', `attachment; filename="${invoiceName}"`)
    //forward data that is read in into the response(writeable stream)
    // file.pipe(res)
  }).catch(err=>next(err))
 
}


