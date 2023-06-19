const mongoose = require("mongoose");
// NOTE - "validator" external library and not the custom middleware at src/middlewares/validate.js
const validator = require("validator");
const config = require("../config/config");
const bcrypt = require("bcryptjs");

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: "-"
    },
    email: {
      type: String,
      required: true,
      trim: true,
      // default: "-",
      unique:true,
      lowercase: true,
      validate(value){
        if(!validator.isEmail(value)){
          throw new Error("Invalid Email");
        }
      }
    },
    password: {
      type: String,
      required: true,
      trim: true,
      default: "-",
      minlength: 8,
      validate(value) {
        if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
          throw new Error(
            "Password must contain at least one letter and one number"
          );
        }
      },
    },
    walletMoney: {
      type: Number,
      required: true,
      trim: "-",
      default: config.default_wallet_money
    },
    address: {
      type: String,
      default: config.default_address,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Check if email is taken
 * @param {string} email - The user's email
 * @returns {Promise<boolean>}
 */
userSchema.statics.isEmailTaken = async function (email) {
 const user = await this.findOne({email});
 return !!user;
};

userSchema.pre('save', function(next) {
  var user = this;
  // only hash the password if it has been modified (or is new)
  if (!user.isModified('password')) return next();
  // generate a salt
  bcrypt.genSalt(function(err, salt) {
      if (err) return next(err);
      // hash the password using our new salt
      bcrypt.hash(user.password, salt, function(err, hash) {
          if (err) return next(err);
          // override the cleartext password with the hashed one
          user.password = hash;
          next();
      });
  });
});

userSchema.methods.isPasswordMatch = async function (password) {
  return bcrypt.compare(password, this.password);
 };

 userSchema.methods.hasSetNonDefaultAddress = async function () {
  const user = this;
   return user.address !== config.default_address;
   //MAKE SURE YOU CHANGE THIS EQAULITY OPERATOR TO NON EQUALITY OPERATOR TO PASS THE TEST CASES
};
/*
 * Create a Mongoose model out of userSchema and export the model as "User"
 * Note: The model should be accessible in a different module when imported like below
 * const User = require("<user.model file path>").User;
 */
/**
 * @typedef User
 */

const User = mongoose.model("users", userSchema);
module.exports = {
  User
};
