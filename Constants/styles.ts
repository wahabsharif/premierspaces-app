import { StyleSheet } from "react-native";
import { color, fontSize } from "./theme";

export default StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
    position: "relative",
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
    paddingHorizontal: 20,
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
    marginTop: 16,
  },
  heading: {
    fontSize: fontSize.large,
    fontWeight: "900",
    marginBottom: 16,
    alignSelf: "center",
    textTransform: "uppercase",
  },

  subHeading: {
    fontSize: fontSize.large,
    fontWeight: "600",
    marginVertical: 12,
    textAlign: "center",
  },
  inputWrapper: {
    flex: 0,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  label: {
    marginRight: 8,
    fontSize: fontSize.large,
    fontWeight: "600",
  },
  floatingIcon: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: color.primary,
    padding: 16,
    borderRadius: 50,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1,
  },
  navigateButton: {
    position: "absolute",
    bottom: 90,
    right: 20,
    backgroundColor: color.primary,
    padding: 16,
    borderRadius: 50,
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1,
  },
  errorText: {
    color: color.red,
    marginTop: 10,
    fontSize: fontSize.medium,
  },
  resultsContainer: {
    paddingVertical: 20,
  },
  resultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: color.secondary,
  },
  selectedItem: {
    backgroundColor: color.primary,
    borderRadius: 5,
  },
  resultText: {
    fontSize: fontSize.medium,
    fontWeight: "600",
  },
  selectedText: {
    color: color.white,
  },
  resultCompany: {
    fontSize: fontSize.small,
    color: color.gray,
  },
  list: {
    flex: 1,
    marginTop: 16,
    marginBottom: 20,
    paddingBottom: 20,
    borderTopWidth: 4,
    borderTopColor: color.secondary,
  },

  image: {
    width: 200,
    height: 200,
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: color.secondary,
    padding: 12,
    borderRadius: 5,
    backgroundColor: color.white,
  },
  button: {
    backgroundColor: color.primary,
    padding: 14,
    borderRadius: 5,
    width: "100%",
    alignItems: "center",
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
});
