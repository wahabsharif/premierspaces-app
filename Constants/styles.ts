import { StyleSheet } from "react-native";
import { color, fontSize } from "./theme";

export default StyleSheet.create({
  screenContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    position: "relative",
    alignItems: "center",
    height: "100%",
  },
  pinContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flex: 1,
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },

  pinLogo: {
    width: 100,
    height: 100,
  },
  headerContainer: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    position: "relative",
    backgroundColor: color.white,
    elevation: 5,
    zIndex: 1,
  },

  headerLogoContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  headerTextContainer: {
    maxWidth: 100,
    justifyContent: "center",
    alignItems: "flex-end",
  },
  headerLogo: {
    width: 30,
    height: 30,
  },
  headerText: {
    fontSize: fontSize.small,
    color: "black",
    textAlign: "left",
  },

  dropdownContainer: {
    position: "absolute",
    top: 60,
    right: 10,
    width: 150,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.secondary,
    borderRadius: 5,
    zIndex: 10,
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  dropdownItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: color.secondary,
  },
  dropdownItemText: {
    fontSize: fontSize.small,
    color: color.gray,
  },
  headingContainer: {
    alignItems: "flex-start",
    marginTop: 10,
    width: "100%",
  },
  heading: {
    fontSize: fontSize.large,
    marginBottom: 16,
    alignSelf: "center",
    textTransform: "capitalize",
  },

  subHeading: {
    fontSize: fontSize.medium,
    marginVertical: 8,
    textAlign: "center",
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.secondary,
    borderRadius: 5,
    paddingHorizontal: 10,
    backgroundColor: color.white,
    marginVertical: 5,
    fontSize: fontSize.small,
    color: color.black,
  },
  label: {
    marginRight: 8,
    fontSize: fontSize.medium,
  },
  screenBanner: {
    backgroundColor: color.white,
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    width: "100%",
  },
  bannerLabel: {
    fontWeight: "600",
    marginBottom: 5,
  },
  bannerText: {
    fontSize: fontSize.small,
    color: color.black,
    paddingLeft: 10,
  },
  errorText: {
    color: color.red,
    marginTop: 10,
    fontSize: fontSize.medium,
    textAlign: "center",
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: color.secondary,
  },
  extraSmallText: {
    fontSize: fontSize.xs,
    color: color.smoke,
    paddingLeft: 10,
  },
  smallText: {
    fontSize: fontSize.small,
    fontWeight: "semibold",
    color: color.gray,
  },
  list: {
    flex: 1,
    marginTop: 16,
    marginBottom: 20,
    paddingBottom: 20,
    borderTopWidth: 4,
    borderTopColor: color.secondary,
    width: "100%",
  },

  image: {
    width: 200,
    height: 200,
    alignItems: "center",
  },

  primaryButton: {
    backgroundColor: color.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginVertical: 5,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  buttonText: {
    color: color.white,
    fontSize: fontSize.medium,
    fontWeight: "600",
  },
  card: {
    width: "85%",
    padding: 25,
    elevation: 8,
    borderRadius: 15,
    backgroundColor: color.white,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
    color: color.black,
  },
  subtitle: {
    fontSize: fontSize.medium,
    textAlign: "center",
    marginBottom: 30,
    color: color.gray,
  },

  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  modalView: {
    margin: 20,
    backgroundColor: color.white,
    borderRadius: 15,
    padding: 35,
    alignItems: "center",
    shadowColor: color.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: "80%",
    position: "relative",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 10,
    color: color.black,
  },
  modalButtonsContainer: {
    flexDirection: "row",
    marginTop: 10,
    justifyContent: "space-between",
  },
  modalButton: {
    borderRadius: 5,
    paddingHorizontal: 20,
    paddingVertical: 10,
    elevation: 2,
    backgroundColor: color.green,
    marginTop: 30,
  },
  modalButtonClose: {
    position: "absolute", // <-- take it out of the normal flow
    top: 10, // <-- adjust as needed
    right: 10, // <-- adjust as needed
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    elevation: 2,
    backgroundColor: color.red,
    zIndex: 10,
  },
  modalText: {
    color: color.gray,
    fontWeight: "bold",
    textAlign: "center",
    fontSize: fontSize.medium,
  },
  modalButtonText: {
    textAlign: "center",
    fontSize: fontSize.small,
    color: color.white,
    letterSpacing: 1,
  },
});
